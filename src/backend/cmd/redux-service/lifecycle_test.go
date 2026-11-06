// Lifecycle contract tests for the readiness line and degraded collaboration
// health, including a real bind failure on an occupied room port.
package main

import (
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"rperedux/server/internal/config"
	"rperedux/server/internal/httpapi"
	"rperedux/server/internal/instances"
	"rperedux/server/internal/store"
)

// testStore opens the SQLite store in a temporary directory for one test.
func testStore(t *testing.T) *store.Store {
	t.Helper()
	data, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	t.Cleanup(func() { _ = data.Close() })
	return data
}

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

func TestListeningEventCarriesIdentityVersionAndPorts(t *testing.T) {
	line, err := json.Marshal(listeningEvent{
		Event:      "listening",
		Name:       httpapi.Name,
		API:        httpapi.APIVersion,
		Port:       config.DefaultPort,
		DB:         "redux.db",
		Version:    "1.0.0-a6",
		CollabPort: config.DefaultCollabPort,
	})
	if err != nil {
		t.Fatal(err)
	}
	var body map[string]any
	if err := json.Unmarshal(line, &body); err != nil {
		t.Fatalf("decode readiness line: %v", err)
	}
	for key, want := range map[string]any{
		"event":      "listening",
		"name":       httpapi.Name,
		"api":        float64(httpapi.APIVersion),
		"port":       float64(config.DefaultPort),
		"db":         "redux.db",
		"version":    "1.0.0-a6",
		"collabPort": float64(config.DefaultCollabPort),
	} {
		if body[key] != want {
			t.Fatalf("readiness %s = %#v, want %#v", key, body[key], want)
		}
	}
}

func TestHealthReportsDegradedWhenCollabPortIsUnavailable(t *testing.T) {
	occupied, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer occupied.Close()
	port := occupied.Addr().(*net.TCPAddr).Port

	listener, status := bindCollabListener(&config.Config{
		CollabHost: "127.0.0.1",
		CollabPort: port,
	})
	if listener != nil {
		listener.Close()
		t.Fatal("bindCollabListener accepted an occupied port")
	}
	if !status.Enabled || status.OK || status.Port != 0 {
		t.Fatalf("degraded status = %#v", status)
	}
	if status.Error == "" {
		t.Fatal("degraded status lost the bind error")
	}

	server := httptest.NewServer(httpapi.NewAPIWithRuntime(testStore(t), instances.NewHub(), status, nil))
	defer server.Close()

	body := decodeHealth(t, server)
	if body["ok"] != false || body["degraded"] != true {
		t.Fatalf("degraded health flags = ok:%#v degraded:%#v", body["ok"], body["degraded"])
	}
	if body["version"] != version {
		t.Fatalf("version = %#v, want %q", body["version"], version)
	}
	if body["collabPort"] != float64(0) {
		t.Fatalf("collabPort = %#v, want 0", body["collabPort"])
	}
	collab, ok := body["collab"].(map[string]any)
	if !ok {
		t.Fatalf("collab = %#v, want object", body["collab"])
	}
	if collab["enabled"] != true || collab["ok"] != false || collab["degraded"] != true {
		t.Fatalf("collab flags = %#v", collab)
	}
	if collab["error"] != status.Error {
		t.Fatalf("collab error = %#v, want %q", collab["error"], status.Error)
	}
}

func TestHealthStaysOKWhenCollaborationIsDisabled(t *testing.T) {
	status := httpapi.CollabHealth{Enabled: false, Error: "collaboration is disabled"}
	server := httptest.NewServer(httpapi.NewAPIWithRuntime(testStore(t), instances.NewHub(), status, nil))
	defer server.Close()

	body := decodeHealth(t, server)
	if body["ok"] != true || body["degraded"] != false {
		t.Fatalf("disabled health flags = ok:%#v degraded:%#v", body["ok"], body["degraded"])
	}
	collab, ok := body["collab"].(map[string]any)
	if !ok || collab["enabled"] != false || collab["ok"] != false {
		t.Fatalf("disabled collab = %#v", body["collab"])
	}
	if _, present := collab["degraded"]; present {
		t.Fatalf("disabled collab reported degraded: %#v", collab)
	}
}
