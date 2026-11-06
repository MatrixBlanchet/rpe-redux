// Shared room-contract vectors read by both the Go server tests and the
// TypeScript room tests.

package collab

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// collabContract is the persisted-state, asset-name, and number fixture shared
// with the TypeScript tests.
type collabContract struct {
	RoomStates []struct {
		Label string `json:"label"`
		State struct {
			MaxMembers *int `json:"maxMembers"`
		} `json:"state"`
		Expected struct {
			MaxMembers int `json:"maxMembers"`
		} `json:"expected"`
	} `json:"roomStates"`
	AssetNames []struct {
		Label    string          `json:"label"`
		Input    json.RawMessage `json:"input"`
		Expected json.RawMessage `json:"expected"`
	} `json:"assetNames"`
	FingerprintNumbers []struct {
		Label     string  `json:"label"`
		Value     float64 `json:"value"`
		Canonical string  `json:"canonical"`
	} `json:"fingerprintNumbers"`
	FingerprintNonFinite []struct {
		Label     string `json:"label"`
		Value     string `json:"value"`
		Canonical string `json:"canonical"`
	} `json:"fingerprintNonFinite"`
	FingerprintDigests []struct {
		Label    string `json:"label"`
		Value    any    `json:"value"`
		Expected string `json:"expected"`
	} `json:"fingerprintDigests"`
}

// collabLoadContract reads the fixture relative to this test file so the test
// does not depend on the working directory.
func collabLoadContract(t *testing.T) collabContract {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot locate collab contract fixture")
	}
	path := filepath.Join(filepath.Dir(file), "..", "..", "..", "test", "fixtures", "collab-contract.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var fixture collabContract
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatalf("decode fixture: %v", err)
	}
	return fixture
}

// collabExpandContractName expands a literal or repeated-name descriptor. The
// second result is false for an expected null (an invalid name).
func collabExpandContractName(t *testing.T, raw json.RawMessage) (string, bool) {
	t.Helper()
	if string(raw) == "null" {
		return "", false
	}
	var literal string
	if err := json.Unmarshal(raw, &literal); err == nil {
		return literal, true
	}
	var repeated struct {
		Repeat string `json:"repeat"`
		Count  int    `json:"count"`
		Suffix string `json:"suffix"`
	}
	if err := json.Unmarshal(raw, &repeated); err != nil {
		t.Fatalf("decode repeated name: %v", err)
	}
	return strings.Repeat(repeated.Repeat, repeated.Count) + repeated.Suffix, true
}

func TestCollabContractRoomStateNormalization(t *testing.T) {
	fixture := collabLoadContract(t)
	for _, entry := range fixture.RoomStates {
		value := 0
		if entry.State.MaxMembers != nil {
			value = *entry.State.MaxMembers
		}
		state := collabState{Rooms: []collabRoomState{{
			ID:          "ROOM",
			Invite:      "invite123",
			HostID:      "host",
			Host:        collabHostState{ID: "host", Token: "token", Profile: collabProfile{Name: "Host", Color: "#ffffff"}},
			Chart:       collabTestChart(),
			Fingerprint: "fingerprint",
			MaxMembers:  value,
			CreatedAt:   1,
		}}}
		rooms := NewRooms()
		rooms.importState(state, nil)
		room := rooms.rooms["ROOM"]
		if room == nil {
			t.Fatalf("%s: room was not imported", entry.Label)
		}
		if room.MaxMembers != entry.Expected.MaxMembers {
			t.Fatalf("%s: maxMembers = %d, want %d", entry.Label, room.MaxMembers, entry.Expected.MaxMembers)
		}
	}
}

func TestCollabContractAssetNameCodePoints(t *testing.T) {
	fixture := collabLoadContract(t)
	for _, entry := range fixture.AssetNames {
		input, valid := collabExpandContractName(t, entry.Input)
		if !valid {
			t.Fatalf("%s: fixture input is null", entry.Label)
		}
		expected, accepted := collabExpandContractName(t, entry.Expected)
		got := collabSanitizeAssetName(input)
		if accepted {
			if got != expected {
				t.Fatalf("%s: sanitize = %q, want %q", entry.Label, got, expected)
			}
		} else if got != "" {
			t.Fatalf("%s: sanitize = %q, want rejection", entry.Label, got)
		}
	}
}

func TestCollabContractFingerprintNumbers(t *testing.T) {
	fixture := collabLoadContract(t)
	for _, entry := range fixture.FingerprintNumbers {
		if got := collabCanonicalNumber(entry.Value); got != entry.Canonical {
			t.Fatalf("%s: canonical = %q, want %q", entry.Label, got, entry.Canonical)
		}
	}
	nonFinite := map[string]float64{
		"NaN":       math.NaN(),
		"Infinity":  math.Inf(1),
		"-Infinity": math.Inf(-1),
	}
	for _, entry := range fixture.FingerprintNonFinite {
		if got := collabCanonicalNumber(nonFinite[entry.Value]); got != entry.Canonical {
			t.Fatalf("%s: canonical = %q, want %q", entry.Label, got, entry.Canonical)
		}
	}
	for _, entry := range fixture.FingerprintDigests {
		if got := collabFingerprint(entry.Value); got != entry.Expected {
			t.Fatalf("%s: fingerprint = %q, want %q", entry.Label, got, entry.Expected)
		}
	}
}
