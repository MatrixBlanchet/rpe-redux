// Read-only hosting for the static documentation site under /docs/. The
// desktop host passes --docs-dir; this file owns path containment, SPA
// fallback, caching, and content types for that surface.

package httpapi

import (
	"io/fs"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// docsRoute is the loopback prefix the settings page opens in a system browser.
const docsRoute = "/docs"

// docsIndex is the SPA shell served for the root and unknown client routes.
const docsIndex = "index.html"

// docsContentTypes pins the formats the generated site ships so the response
// does not depend on the host's MIME registry.
var docsContentTypes = map[string]string{
	".css":         "text/css; charset=utf-8",
	".gif":         "image/gif",
	".htm":         "text/html; charset=utf-8",
	".html":        "text/html; charset=utf-8",
	".ico":         "image/x-icon",
	".jpeg":        "image/jpeg",
	".jpg":         "image/jpeg",
	".js":          "text/javascript; charset=utf-8",
	".json":        "application/json; charset=utf-8",
	".map":         "application/json; charset=utf-8",
	".md":          "text/markdown; charset=utf-8",
	".mjs":         "text/javascript; charset=utf-8",
	".otf":         "font/otf",
	".pdf":         "application/pdf",
	".png":         "image/png",
	".svg":         "image/svg+xml",
	".ttf":         "font/ttf",
	".txt":         "text/plain; charset=utf-8",
	".wasm":        "application/wasm",
	".webmanifest": "application/manifest+json",
	".webp":        "image/webp",
	".woff":        "font/woff",
	".woff2":       "font/woff2",
	".xml":         "application/xml; charset=utf-8",
}

// docsHandler serves one documentation directory. An empty root disables the
// route and answers 503 so a caller can tell "not installed" from "not found".
type docsHandler struct {
	root string
}

// newDocsHandler cleans the configured directory to an absolute path. The
// directory may be absent; requests then return 404 instead of failing startup.
func newDocsHandler(dir string) *docsHandler {
	root := ""
	if trimmed := strings.TrimSpace(dir); trimmed != "" {
		if absolute, err := filepath.Abs(trimmed); err == nil {
			root = filepath.Clean(absolute)
		} else {
			root = filepath.Clean(trimmed)
		}
		if resolved, err := filepath.EvalSymlinks(root); err == nil {
			root = resolved
		}
	}
	return &docsHandler{root: root}
}

// isDocsPath reports whether a URL belongs to the documentation surface.
func isDocsPath(urlPath string) bool {
	return urlPath == docsRoute || strings.HasPrefix(urlPath, docsRoute+"/")
}

// available reports whether the configured directory carries its index page.
// The desktop host uses the same predicate to decide whether a running sidecar
// can be reused for this launch.
func (h *docsHandler) available() bool {
	if h.root == "" {
		return false
	}
	info, err := os.Stat(filepath.Join(h.root, docsIndex))
	return err == nil && info.Mode().IsRegular()
}

// ServeHTTP serves one document, redirects the bare prefix, and keeps every
// response inside the configured directory. Unknown client routes receive the
// SPA shell; a missing file with an extension stays a 404.
func (h *docsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method "+r.Method+" is not allowed for this resource")
		return
	}
	if h.root == "" {
		writeError(w, http.StatusServiceUnavailable, "docs_unavailable", "the documentation site is not configured")
		return
	}
	if r.URL.Path == docsRoute {
		http.Redirect(w, r, docsRoute+"/", http.StatusFound)
		return
	}
	name := strings.TrimPrefix(r.URL.Path, docsRoute+"/")
	file, info, ok := h.open(name)
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", "no such documentation file")
		return
	}
	defer file.Close()
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Type", docsContentType(info.Name()))
	http.ServeContent(w, r, info.Name(), info.ModTime(), file)
}

// open resolves a URL-relative name to a regular file inside the root. A
// directory serves its own index page, and an unknown extensionless route falls
// back to the root shell.
func (h *docsHandler) open(name string) (*os.File, fs.FileInfo, bool) {
	candidate, ok := resolveDocsPath(h.root, name)
	if !ok {
		return nil, nil, false
	}
	if file, info, ok := openDocsFile(candidate); ok {
		return file, info, true
	} else if info != nil && info.IsDir() {
		if file, info, ok := h.openContained(filepath.Join(candidate, docsIndex)); ok {
			return file, info, true
		}
	}
	if trimmed := strings.TrimSuffix(name, "/"); trimmed != "" && path.Ext(trimmed) != "" {
		return nil, nil, false
	}
	return h.openContained(filepath.Join(h.root, docsIndex))
}

// openContained opens an absolute candidate only when it stays inside the root
// after symlink resolution.
func (h *docsHandler) openContained(candidate string) (*os.File, fs.FileInfo, bool) {
	if !docsWithinRoot(h.root, candidate) {
		return nil, nil, false
	}
	return openDocsFile(candidate)
}

// openDocsFile stats and opens one regular file. Directories and missing files
// report false; the file info is still returned for the directory branch.
func openDocsFile(name string) (*os.File, fs.FileInfo, bool) {
	info, err := os.Stat(name)
	if err != nil || !info.Mode().IsRegular() {
		return nil, info, false
	}
	file, err := os.Open(name)
	if err != nil {
		return nil, info, false
	}
	return file, info, true
}

// resolveDocsPath joins a URL-relative name onto root and rejects absolute
// paths, Windows separators and drive/alternate-stream syntax, and backtracking
// segments before the filesystem is touched.
func resolveDocsPath(root, name string) (string, bool) {
	if strings.ContainsRune(name, 0) ||
		strings.Contains(name, "\\") ||
		strings.HasPrefix(name, "/") ||
		strings.Contains(name, ":") {
		return "", false
	}
	cleaned := filepath.Clean(filepath.Join(root, filepath.FromSlash(name)))
	if !docsWithinRoot(root, cleaned) {
		return "", false
	}
	return cleaned, true
}

// docsWithinRoot reports whether candidate is root or a descendant. Symlinks
// are resolved when they exist so a link cannot escape the documentation tree.
func docsWithinRoot(root, candidate string) bool {
	if !pathInside(root, candidate) {
		return false
	}
	resolved, err := filepath.EvalSymlinks(candidate)
	if err != nil {
		return true
	}
	return pathInside(root, resolved)
}

// pathInside is the lexical containment check shared by normal and resolved
// paths.
func pathInside(root, candidate string) bool {
	rel, err := filepath.Rel(root, candidate)
	if err != nil || filepath.IsAbs(rel) || rel == ".." {
		return false
	}
	return !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

// docsContentType maps a file name to a deterministic response type.
func docsContentType(name string) string {
	extension := strings.ToLower(path.Ext(name))
	if value, ok := docsContentTypes[extension]; ok {
		return value
	}
	if value := mime.TypeByExtension(extension); value != "" {
		return value
	}
	return "application/octet-stream"
}
