// Contract tests for the sidecar health payload and the desktop shutdown route.
package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"rperedux/server/internal/instances"
)

// decodeHealth returns the JSON object served by GET /api/health.
func decodeHealth(t *testing.T, server *httptest.Server) map[string]any {
	t.Helper()
	response, err := http.Get(server.URL + "/api/health")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var body map[string]any
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode health: %v", err)
	}
	return body
}

func TestHealthReportsVersionAndCollabStatus(t *testing.T) {
	store := testStore(t)
	status := CollabHealth{
		Enabled: true,
		OK:      false,
		Port:    47830,
		Error:   "collaboration listener unavailable: address already in use",
	}
	server := httptest.NewServer(NewAPIWithRuntime(store, instances.NewHub(), status, nil))
	defer server.Close()

	body := decodeHealth(t, server)
	if body["name"] != Name || body["api"] != float64(APIVersion) {
		t.Fatalf("identity fields changed: %#v", body)
	}
	if body["version"] != Version {
		t.Fatalf("version = %#v, want %q", body["version"], Version)
	}
	collab, ok := body["collab"].(map[string]any)
	if !ok {
		t.Fatalf("collab = %#v, want object", body["collab"])
	}
	if collab["enabled"] != true || collab["ok"] != false {
		t.Fatalf("collab flags = %#v", collab)
	}
	if collab["port"] != float64(47830) {
		t.Fatalf("collab port = %#v", collab["port"])
	}
	if collab["error"] != status.Error {
		t.Fatalf("collab error = %#v", collab["error"])
	}
	for _, key := range []string{"ok", "projects", "instances", "backendId", "db"} {
		if _, present := body[key]; !present {
			t.Fatalf("health lost legacy field %q: %#v", key, body)
		}
	}
}

func TestShutdownRouteSignalsHostAndRejectsRemotePeers(t *testing.T) {
	store := testStore(t)
	signals := make(chan struct{}, 1)
	handler := NewAPIWithRuntime(
		store,
		instances.NewHub(),
		CollabHealth{Enabled: true, OK: true, Port: 47830},
		func() { signals <- struct{}{} },
	)

	request := httptest.NewRequest(http.MethodPost, "/api/shutdown", nil)
	request.Header.Set(ClientHeader, "1")
	request.RemoteAddr = "127.0.0.1:53000"
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("loopback shutdown status = %d, want 200: %s", recorder.Code, recorder.Body)
	}
	select {
	case <-signals:
	default:
		t.Fatal("loopback shutdown did not signal the host")
	}

	request = httptest.NewRequest(http.MethodPost, "/api/shutdown", nil)
	request.Header.Set(ClientHeader, "1")
	request.RemoteAddr = "192.0.2.10:53000"
	recorder = httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("remote shutdown status = %d, want 403: %s", recorder.Code, recorder.Body)
	}
	select {
	case <-signals:
		t.Fatal("remote shutdown reached the host")
	default:
	}
}
