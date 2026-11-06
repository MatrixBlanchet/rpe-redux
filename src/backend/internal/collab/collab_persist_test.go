// Tests for the debounced room snapshot and content-addressed asset files.

package collab

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCollabPersisterRestoresRoomsAndAssets(t *testing.T) {
	directory := t.TempDir()
	rooms := NewRooms()
	room, host, failure := rooms.create(collabProfile{Name: "Host", Color: "#ffffff"}, collabTestChart(), "")
	if failure != nil {
		t.Fatalf("create: %v", failure)
	}
	_, request, _ := rooms.requestJoin(room.ID, room.Invite, collabProfile{Name: "Editor", Color: "#00ff00"})
	_, _, editor, _ := rooms.approve(room.HostID, request.RequestID, true, "editor")
	if _, failure := rooms.commit(editor.ID, "tx", "edit", []collabChange{
		{Op: "set", Path: "/META/name", Before: "room", After: "persisted"},
	}, ""); failure != nil {
		t.Fatalf("commit: %v", failure)
	}
	bytes := []byte("\x89PNG\r\n\x1a\npersisted")
	hash := sha256Hex(bytes)
	if _, failure := rooms.acceptAsset(editor.ID, "cover.png", hash, int64(len(bytes)), "image/png", bytes); failure != nil {
		t.Fatalf("asset: %v", failure)
	}
	persister := NewPersister(directory, rooms, nil)
	if err := persister.saveBlob(hash, bytes); err != nil {
		t.Fatalf("save blob: %v", err)
	}
	if err := persister.Close(); err != nil {
		t.Fatalf("close: %v", err)
	}
	if _, err := os.Stat(filepath.Join(directory, "assets", hash)); err != nil {
		t.Fatal(err)
	}

	restored := NewRooms()
	if err := NewPersister(directory, restored, nil).Load(); err != nil {
		t.Fatalf("load: %v", err)
	}
	restoredRoom, restoredHost, failure := restored.resume(room.ID, host.Token)
	if failure != nil {
		t.Fatalf("resume: %v", failure)
	}
	if restoredHost.Role != "host" || restoredRoom.Revision != 1 {
		t.Fatalf("restored = %+v", restoredRoom)
	}
	if restoredRoom.Chart.(map[string]any)["META"].(map[string]any)["name"] != "persisted" {
		t.Fatal("chart was not persisted")
	}
	if restoredRoom.Assets["cover.png"].Hash != hash {
		t.Fatal("asset manifest was not persisted")
	}
	if _, ok := restored.blob(hash); !ok {
		t.Fatal("asset blob was not restored")
	}
}
