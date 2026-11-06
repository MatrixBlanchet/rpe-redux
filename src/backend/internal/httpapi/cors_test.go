// CORS regression tests for the production/dev origin split and preflight
// rejection of origins that are not on the allowlist.

package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"rperedux/server/internal/config"
)

// corsRequest sends one request with an Origin header.
func corsRequest(t *testing.T, url, method, origin string) *http.Response {
	t.Helper()
	request, err := http.NewRequest(method, url+"/api/preferences", nil)
	if err != nil {
		t.Fatal(err)
	}
	if origin != "" {
		request.Header.Set("Origin", origin)
	}
	if method != http.MethodGet && method != http.MethodHead {
		request.Header.Set(ClientHeader, "1")
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = response.Body.Close() })
	return response
}

func TestCORSRejectsDevelopmentOriginsInProduction(t *testing.T) {
	store := testStore(t)
	server := httptest.NewServer(NewAPI(store))
	defer server.Close()

	for _, origin := range config.DevOrigins {
		response := corsRequest(t, server.URL, http.MethodOptions, origin)
		if response.StatusCode != http.StatusForbidden {
			t.Fatalf("preflight for %q status = %d, want 403", origin, response.StatusCode)
		}
		if response.Header.Get("Access-Control-Allow-Origin") != "" {
			t.Fatalf("preflight for %q leaked an allow-origin header", origin)
		}
	}
	if response := corsRequest(t, server.URL, http.MethodGet, "https://example.com"); response.StatusCode != http.StatusForbidden {
		t.Fatalf("foreign GET status = %d, want 403", response.StatusCode)
	}
}

func TestCORSAllowsDesktopOriginAndExplicitDevelopmentOrigins(t *testing.T) {
	store := testStore(t)
	server := httptest.NewServer(NewAPI(store, config.DevOrigins...))
	defer server.Close()

	for _, origin := range append([]string{"http://tauri.localhost"}, config.DevOrigins...) {
		response := corsRequest(t, server.URL, http.MethodOptions, origin)
		if response.StatusCode != http.StatusNoContent {
			t.Fatalf("preflight for %q status = %d, want 204", origin, response.StatusCode)
		}
		if response.Header.Get("Access-Control-Allow-Origin") != origin {
			t.Fatalf("preflight for %q allow-origin = %q", origin, response.Header.Get("Access-Control-Allow-Origin"))
		}
	}
}

func TestCORSRejectsMalformedAndForeignOrigins(t *testing.T) {
	store := testStore(t)
	server := httptest.NewServer(NewAPI(store))
	defer server.Close()

	for _, origin := range []string{"null", "file://", "http://tauri.localhost/path", "http://localhost:9999"} {
		response := corsRequest(t, server.URL, http.MethodOptions, origin)
		if response.StatusCode != http.StatusForbidden {
			t.Fatalf("preflight for %q status = %d, want 403", origin, response.StatusCode)
		}
	}
}
