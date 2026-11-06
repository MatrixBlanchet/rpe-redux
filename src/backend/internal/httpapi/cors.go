// CORS policy for the loopback API. The desktop origins are always accepted;
// local Vite origins are added only when the sidecar runs in development, so a
// production build cannot be reached by a page served from a developer port.

package httpapi

import (
	"net/http"
	"net/url"
	"strings"

	"rperedux/server/internal/config"
	"rperedux/server/internal/preferences"
)

// ClientHeader marks requests from the application's own client. It is not a
// secret; requiring it forces mutating cross-origin requests through preflight,
// which the origin allowlist can reject.
const ClientHeader = "X-Redux-Client"

// normalizeOrigin accepts only a serialized http(s) origin and returns its
// canonical scheme and host casing. Browsers send an origin, not a URL, so a
// path, query, user info, or opaque value is rejected instead of compared
// loosely.
func normalizeOrigin(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", false
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.User != nil || parsed.Host == "" {
		return "", false
	}
	if parsed.Path != "" && parsed.Path != "/" {
		return "", false
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", false
	}
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return "", false
	}
	return scheme + "://" + strings.ToLower(parsed.Host), true
}

// originSet builds the allowlist from the packaged origins plus an explicit
// development or harness list.
func originSet(extra []string) map[string]bool {
	allowed := make(map[string]bool, len(config.DefaultOrigins)+len(extra))
	for _, origin := range append(append([]string{}, config.DefaultOrigins...), extra...) {
		if normalized, ok := normalizeOrigin(origin); ok {
			allowed[normalized] = true
		}
	}
	return allowed
}

// originInSet reports whether a request's Origin is allowed. A request without
// an Origin is a native client and is not subject to browser CORS.
func originInSet(raw string, allowed map[string]bool) (string, bool) {
	if raw == "" {
		return "", true
	}
	normalized, ok := normalizeOrigin(raw)
	if !ok {
		return "", false
	}
	return normalized, allowed[normalized]
}

// withCORS enforces the origin allowlist before dispatch, answers preflight only
// for an allowed origin, and requires the application client header on every
// mutating request.
func withCORS(next http.Handler, allowed map[string]bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		origin, allowedOrigin := originInSet(r.Header.Get("Origin"), allowed)
		if r.Header.Get("Origin") != "" && !allowedOrigin {
			writeError(w, http.StatusForbidden, "origin_denied", "origin is not allowed")
			return
		}
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
			w.Header().Set(
				"Access-Control-Allow-Headers",
				"Content-Type, Authorization, "+ClientHeader+", "+preferences.TokenHeader,
			)
			w.Header().Set(
				"Access-Control-Expose-Headers",
				"Content-Length, Content-Range, Accept-Ranges, ETag",
			)
			w.Header().Set("Access-Control-Max-Age", "600")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			if r.Header.Get(ClientHeader) != "1" {
				writeError(w, http.StatusForbidden, "client_header_required", "missing client header")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
