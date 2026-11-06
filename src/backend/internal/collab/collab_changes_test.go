// Tests for the shared chart-change semantics and stable fingerprint used by
// the embedded collaboration server.

package collab

import (
	"reflect"
	"testing"
)

func collabTestChart() map[string]any {
	return map[string]any{
		"META": map[string]any{"name": "room"},
		"BPMList": []any{
			map[string]any{"beat": []any{0.0, 0.0, 1.0}, "bpm": 120.0},
		},
		"judgeLineList": []any{
			map[string]any{
				"id": "line",
				"notes": []any{
					map[string]any{"id": "note", "positionX": 1.0},
					map[string]any{"id": "note2", "positionX": 2.0},
				},
				"eventLayers": []any{},
			},
		},
	}
}

func TestCollabFingerprintMatchesTypeScript(t *testing.T) {
	value := map[string]any{
		"META": map[string]any{"name": "房间"},
		"judgeLineList": []any{
			map[string]any{"id": "a", "notes": []any{}},
		},
		"BPMList": []any{
			map[string]any{"bpm": 120.0, "beat": []any{0.0, 0.0, 1.0}},
		},
	}
	if got, want := collabFingerprint(value), "ecaa3098"; got != want {
		t.Fatalf("fingerprint = %s, want %s", got, want)
	}
}

func TestCollabApplyChangesMutatesNestedObjectsAndArrays(t *testing.T) {
	chart := collabTestChart()
	before := collabClone(chart)
	changes := []collabChange{
		{
			Op:     "set",
			Path:   "/judgeLineList/$line/notes/$note/positionX",
			Before: 1.0,
			After:  3.0,
		},
		{
			Op:       "add",
			Path:     "/judgeLineList/$line/notes/$new",
			After:    map[string]any{"id": "new", "positionX": 4.0},
			Position: intPointer(1),
		},
		{
			Op:     "remove",
			Path:   "/judgeLineList/$line/notes/$note2",
			Before: map[string]any{"id": "note2", "positionX": 2.0},
		},
	}
	applied, conflicts := collabApplyChanges(chart, changes)
	if len(conflicts) != 0 {
		t.Fatalf("conflicts = %v", conflicts)
	}
	if !reflect.DeepEqual(chart, before) {
		t.Fatal("apply mutated the input chart")
	}
	lines := applied.(map[string]any)["judgeLineList"].([]any)
	notes := lines[0].(map[string]any)["notes"].([]any)
	if len(notes) != 2 {
		t.Fatalf("notes = %v", notes)
	}
	if notes[0].(map[string]any)["id"] != "note" || notes[0].(map[string]any)["positionX"] != 3.0 {
		t.Fatalf("first note = %v", notes[0])
	}
	if notes[1].(map[string]any)["id"] != "new" {
		t.Fatalf("inserted note = %v", notes[1])
	}
}

func TestCollabApplyRejectsStaleBasesAndDuplicateAdds(t *testing.T) {
	chart := collabTestChart()
	stale, conflicts := collabApplyChanges(chart, []collabChange{
		{Op: "set", Path: "/META/name", Before: "other", After: "next"},
	})
	if len(conflicts) != 1 || !reflect.DeepEqual(stale, chart) {
		t.Fatalf("stale result = %v, %v", stale, conflicts)
	}
	duplicate, conflicts := collabApplyChanges(chart, []collabChange{
		{
			Op:       "add",
			Path:     "/judgeLineList/$line/notes/$note",
			After:    map[string]any{"id": "note"},
			Position: intPointer(0),
		},
	})
	if len(conflicts) != 1 || !reflect.DeepEqual(duplicate, chart) {
		t.Fatalf("duplicate add result = %v, %v", duplicate, conflicts)
	}
}

func TestCollabLockKeysDistinguishLinesAndObjects(t *testing.T) {
	object := collabChangeLockKeys([]collabChange{
		{Op: "set", Path: "/judgeLineList/$line/notes/$note/positionX"},
	})
	if object.chart || !reflect.DeepEqual(object.lines, []string{"line:line"}) ||
		!reflect.DeepEqual(object.objects, []string{"obj:note"}) {
		t.Fatalf("object keys = %+v", object)
	}
	line := collabChangeLockKeys([]collabChange{
		{Op: "set", Path: "/judgeLineList/$line/Texture"},
	})
	if line.chart || !reflect.DeepEqual(line.lines, []string{"line:line"}) || len(line.objects) != 0 {
		t.Fatalf("line keys = %+v", line)
	}
	chart := collabChangeLockKeys([]collabChange{
		{Op: "remove", Path: "/judgeLineList/$line"},
	})
	if !chart.chart {
		t.Fatalf("topology keys = %+v", chart)
	}
}

func intPointer(value int) *int {
	return &value
}

func TestCollabApplyChangesReplacesIndexAndIDOnSet(t *testing.T) {
	chart := collabTestChart()
	bpmBefore := chart["BPMList"].([]any)[0]
	notesBefore := chart["judgeLineList"].([]any)[0].(map[string]any)["notes"].([]any)[0]
	changes := []collabChange{
		{
			Op:     "set",
			Path:   "/BPMList/0",
			Before: bpmBefore,
			After:  map[string]any{"beat": []any{0.0, 0.0, 1.0}, "bpm": 180.0},
		},
		{
			Op:     "set",
			Path:   "/judgeLineList/$line/notes/$note",
			Before: notesBefore,
			After:  map[string]any{"id": "note", "positionX": 9.0},
		},
	}
	applied, conflicts := collabApplyChanges(chart, changes)
	if len(conflicts) != 0 {
		t.Fatalf("conflicts = %v", conflicts)
	}
	bpm := applied.(map[string]any)["BPMList"].([]any)[0].(map[string]any)["bpm"]
	if bpm != 180.0 {
		t.Fatalf("bpm = %v", bpm)
	}
	notes := applied.(map[string]any)["judgeLineList"].([]any)[0].(map[string]any)["notes"].([]any)
	if len(notes) != 2 {
		t.Fatalf("notes = %v", notes)
	}
	if notes[0].(map[string]any)["positionX"] != 9.0 {
		t.Fatalf("first note = %v", notes[0])
	}
}
