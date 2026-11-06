// Protocol handshake tests for the embedded collaboration server: the numeric
// revision is required and malformed handshakes never create room state.

package collab

import (
	"net/http/httptest"
	"testing"
)

func TestCollabProtocolRequiresSupportedNumericVersion(t *testing.T) {
	cases := []struct {
		name     string
		message  map[string]any
		accepted bool
	}{
		{"current", map[string]any{"protocolVersion": 1.0}, true},
		{"missing", map[string]any{}, false},
		{"string", map[string]any{"protocolVersion": "1"}, false},
		{"fractional", map[string]any{"protocolVersion": 1.5}, false},
		{"older", map[string]any{"protocolVersion": 0.0}, false},
		{"newer", map[string]any{"protocolVersion": 2.0}, false},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			if accepted := collabProtocolAccepted(testCase.message); accepted != testCase.accepted {
				t.Fatalf("accepted = %v, want %v", accepted, testCase.accepted)
			}
			failure := collabProtocolFailure(testCase.message)
			if testCase.accepted && failure != nil {
				t.Fatalf("unexpected failure: %v", failure)
			}
			if !testCase.accepted && (failure == nil || failure.Code != "protocol_mismatch") {
				t.Fatalf("failure = %v", failure)
			}
		})
	}
}

func TestCollabWebSocketRejectsMalformedProtocolVersion(t *testing.T) {
	rooms := NewRooms()
	server := NewServer(rooms, nil, nil)
	httpServer := httptest.NewServer(server.Handler())
	defer httpServer.Close()

	socket := dialTestWS(t, httpServer.URL)
	defer socket.close()
	messages := []map[string]any{
		{
			"type":    "create",
			"profile": map[string]any{"name": "Host", "color": "#ffffff"},
			"chart":   collabTestChart(),
		},
		{
			"type":            "create",
			"profile":         map[string]any{"name": "Host", "color": "#ffffff"},
			"chart":           collabTestChart(),
			"protocolVersion": "1",
		},
	}
	for _, message := range messages {
		socket.sendJSON(t, message)
		rejected := socket.readUntil(t, "error")
		if rejected["code"] != "protocol_mismatch" {
			t.Fatalf("rejection = %v", rejected)
		}
	}
	if rooms.roomCount() != 0 {
		t.Fatalf("rooms = %d", rooms.roomCount())
	}
}
