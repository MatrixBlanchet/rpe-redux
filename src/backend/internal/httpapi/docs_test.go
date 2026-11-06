// Contract tests for the read-only documentation surface: SPA fallback, nested
// assets, content types, traversal containment, method limits, and health.
package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"rperedux/server/internal/config"
	"rperedux/server/internal/instances"
)

// writeDocsFixture writes one fixture file and creates its parent directories.
func writeDocsFixture(t *testing.T, name, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(name), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(name, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

// docsFixture builds a minimal generated site and returns its root.
func docsFixture(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	writeDocsFixture(t, filepath.Join(root, "index.html"), "<!doctype html><title>docs shell</title>")
	writeDocsFixture(t, filepath.Join(root, "content.json"), `{"pages":[]}`)
	writeDocsFixture(t, filepath.Join(root, "guide", "index.html"), "<!doctype html><title>guide</title>")
	writeDocsFixture(t, filepath.Join(root, "assets", "app.js"), "console.log('docs')")
	writeDocsFixture(t, filepath.Join(root, "assets", "style.css"), "body{color:black}")
	writeDocsFixture(t, filepath.Join(root, "assets", "logo.svg"), "<svg></svg>")
	writeDocsFixture(t, filepath.Join(root, "assets", "shot.png"), "png")
	writeDocsFixture(t, filepath.Join(root, "fonts", "site.woff2"), "woff2")
	return root
}

// docsRequest sends one request through a handler and returns the recorder.
func docsRequest(t *testing.T, handler http.Handler, method, target string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(method, target, nil)
	request.Header.Set(ClientHeader, "1")
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

// docsServer mounts the documentation directory through the full API tree.
func docsServer(t *testing.T, dir string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(
		NewAPIWithRuntimeAndDocs(testStore(t), instances.NewHub(), CollabHealth{}, nil, dir),
	)
	t.Cleanup(server.Close)
	return server
}

func TestDocsServesIndexForRootAndSpaRoutes(t *testing.T) {
	handler := newDocsHandler(docsFixture(t))
	for _, target := range []string{"/docs/", "/docs/getting-started", "/docs/guide/deep/link"} {
		response := docsRequest(t, handler, http.MethodGet, target)
		if response.Code != http.StatusOK {
			t.Fatalf("%s status = %d, want 200: %s", target, response.Code, response.Body)
		}
		if !strings.Contains(response.Body.String(), "docs shell") {
			t.Fatalf("%s did not serve the SPA shell: %q", target, response.Body)
		}
		if contentType := response.Header().Get("Content-Type"); contentType != "text/html; charset=utf-8" {
			t.Fatalf("%s content type = %q", target, contentType)
		}
		if cache := response.Header().Get("Cache-Control"); cache != "no-cache" {
			t.Fatalf("%s cache control = %q", target, cache)
		}
	}
}

func TestDocsServesDirectoryIndexAndNestedAssets(t *testing.T) {
	handler := newDocsHandler(docsFixture(t))

	guide := docsRequest(t, handler, http.MethodGet, "/docs/guide/")
	if guide.Code != http.StatusOK || !strings.Contains(guide.Body.String(), "<title>guide</title>") {
		t.Fatalf("directory index = %d %q", guide.Code, guide.Body)
	}

	wantTypes := map[string]string{
		"/docs/content.json":     "application/json; charset=utf-8",
		"/docs/assets/app.js":    "text/javascript; charset=utf-8",
		"/docs/assets/style.css": "text/css; charset=utf-8",
		"/docs/assets/logo.svg":  "image/svg+xml",
		"/docs/assets/shot.png":  "image/png",
		"/docs/fonts/site.woff2": "font/woff2",
	}
	for target, want := range wantTypes {
		response := docsRequest(t, handler, http.MethodGet, target)
		if response.Code != http.StatusOK {
			t.Fatalf("%s status = %d, want 200", target, response.Code)
		}
		if contentType := response.Header().Get("Content-Type"); contentType != want {
			t.Fatalf("%s content type = %q, want %q", target, contentType, want)
		}
		if cache := response.Header().Get("Cache-Control"); cache != "no-cache" {
			t.Fatalf("%s cache control = %q", target, cache)
		}
	}
}

func TestDocsReturns404ForMissingAssetsAndPage(t *testing.T) {
	root := t.TempDir()
	handler := newDocsHandler(root)
	response := docsRequest(t, handler, http.MethodGet, "/docs/assets/missing.js")
	if response.Code != http.StatusNotFound {
		t.Fatalf("missing asset status = %d, want 404: %s", response.Code, response.Body)
	}
	var body errorBody
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("missing asset error body: %v", err)
	}
	if body.Error.Code != "not_found" {
		t.Fatalf("missing asset code = %q", body.Error.Code)
	}
	if contentType := response.Header().Get("Content-Type"); contentType != "application/json; charset=utf-8" {
		t.Fatalf("missing asset content type = %q", contentType)
	}
}

func TestDocsRejectsTraversalOutsideTheRoot(t *testing.T) {
	parent := t.TempDir()
	root := filepath.Join(parent, "docs")
	writeDocsFixture(t, filepath.Join(root, "index.html"), "<!doctype html><title>docs shell</title>")
	writeDocsFixture(t, filepath.Join(parent, "secret.txt"), "outside-secret")
	handler := newDocsHandler(root)

	targets := []string{
		"/docs/../secret.txt",
		"/docs/%2e%2e/secret.txt",
		"/docs/assets/../../secret.txt",
		"/docs/%2e%2e%2fsecret.txt",
		"/docs/..%5csecret.txt",
		"/docs/%2fetc%2fpasswd",
		"/docs/C:%5cWindows%5cwin.ini",
	}
	for _, target := range targets {
		response := docsRequest(t, handler, http.MethodGet, target)
		if response.Code == http.StatusOK {
			t.Fatalf("%s escaped the documentation root: %q", target, response.Body)
		}
		if strings.Contains(response.Body.String(), "outside-secret") {
			t.Fatalf("%s leaked a file outside the root", target)
		}
	}
}

func TestDocsRejectsMethodsOtherThanGetAndHead(t *testing.T) {
	handler := newDocsHandler(docsFixture(t))
	response := docsRequest(t, handler, http.MethodPost, "/docs/")
	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST status = %d, want 405: %s", response.Code, response.Body)
	}
	if allow := response.Header().Get("Allow"); allow != "GET, HEAD" {
		t.Fatalf("Allow = %q", allow)
	}
	head := docsRequest(t, handler, http.MethodHead, "/docs/")
	if head.Code != http.StatusOK || head.Body.Len() != 0 {
		t.Fatalf("HEAD = %d body %d bytes", head.Code, head.Body.Len())
	}
}

func TestDocsBarePrefixRedirectsThroughTheAPIRoute(t *testing.T) {
	server := docsServer(t, docsFixture(t))
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}}
	response, err := client.Get(server.URL + "/docs")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusFound {
		t.Fatalf("/docs status = %d, want 302", response.StatusCode)
	}
	if location := response.Header.Get("Location"); location != "/docs/" {
		t.Fatalf("/docs location = %q", location)
	}
}

func TestDocsUnconfiguredReturns503(t *testing.T) {
	response := docsRequest(t, newDocsHandler(""), http.MethodGet, "/docs/")
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured status = %d, want 503: %s", response.Code, response.Body)
	}
	var body errorBody
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("unconfigured error body: %v", err)
	}
	if body.Error.Code != "docs_unavailable" {
		t.Fatalf("unconfigured code = %q", body.Error.Code)
	}

	server := httptest.NewServer(NewAPI(testStore(t)))
	defer server.Close()
	request, err := http.NewRequest(http.MethodGet, server.URL+"/docs/", nil)
	if err != nil {
		t.Fatal(err)
	}
	response2, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response2.Body.Close()
	if response2.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("API /docs/ status = %d, want 503", response2.StatusCode)
	}
}

func TestHealthReportsDocsAvailability(t *testing.T) {
	enabled := httptest.NewServer(
		NewAPIWithRuntimeAndDocs(testStore(t), instances.NewHub(), CollabHealth{}, nil, docsFixture(t)),
	)
	defer enabled.Close()
	if body := decodeHealth(t, enabled); body["docs"] != true {
		t.Fatalf("docs health = %#v, want true", body["docs"])
	}

	disabled := httptest.NewServer(NewAPI(testStore(t)))
	defer disabled.Close()
	if body := decodeHealth(t, disabled); body["docs"] != false {
		t.Fatalf("docs health = %#v, want false", body["docs"])
	}
}

func TestDocsDirFlagDefaultsOffAndRejectsFiles(t *testing.T) {
	db := filepath.Join(t.TempDir(), "redux.db")
	cfg, err := config.Resolve([]string{"--db", db})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DocsDir != "" {
		t.Fatalf("default docs dir = %q, want empty", cfg.DocsDir)
	}

	dir := t.TempDir()
	cfg, err = config.Resolve([]string{"--db", db, "--docs-dir", dir})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DocsDir != filepath.Clean(dir) {
		t.Fatalf("docs dir = %q, want %q", cfg.DocsDir, filepath.Clean(dir))
	}

	file := filepath.Join(t.TempDir(), "site.txt")
	writeDocsFixture(t, file, "not a directory")
	if _, err := config.Resolve([]string{"--db", db, "--docs-dir", file}); err == nil {
		t.Fatal("--docs-dir accepted a regular file")
	}
}
