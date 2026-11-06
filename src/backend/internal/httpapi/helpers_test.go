// Shared store fixtures for the HTTP contract tests.

package httpapi

import (
	"path/filepath"
	"testing"

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
