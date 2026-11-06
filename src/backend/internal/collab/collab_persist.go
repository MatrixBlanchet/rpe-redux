// Durable collaboration state for the desktop sidecar: one JSON room document
// plus content-addressed asset files. Writes are debounced, atomic, and closed
// on shutdown.

package collab

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// collabPersistDelay debounces room writes after a state change.
const collabPersistDelay = 200 * time.Millisecond

// Persister owns the room document and content-addressed asset files on
// disk.
type Persister struct {
	mu     sync.Mutex
	dir    string
	rooms  *Rooms
	logger *log.Logger
	timer  *time.Timer
	dirty  bool
	closed bool
}

// NewPersister binds a persister to a data directory and room set.
func NewPersister(dir string, rooms *Rooms, logger *log.Logger) *Persister {
	return &Persister{dir: dir, rooms: rooms, logger: logger}
}

// enabled reports whether a data directory was configured.
func (p *Persister) enabled() bool {
	return p != nil && p.dir != ""
}

// assetDir is the content-addressed asset directory.
func (p *Persister) assetDir() string {
	return filepath.Join(p.dir, "assets")
}

// Load restores rooms and their asset blobs. An unreadable room document is
// moved aside and reported instead of being overwritten.
func (p *Persister) Load() error {
	if !p.enabled() {
		return nil
	}
	if err := os.MkdirAll(p.assetDir(), 0o700); err != nil {
		return err
	}
	raw, err := os.ReadFile(filepath.Join(p.dir, "rooms.json"))
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var state collabState
	if err := json.Unmarshal(raw, &state); err != nil {
		// Preserve the unreadable document so the next flush cannot replace it
		// with empty state.
		_ = os.Rename(
			filepath.Join(p.dir, "rooms.json"),
			filepath.Join(p.dir, "rooms.json.corrupt-"+time.Now().Format("20060102-150405")),
		)
		return err
	}
	blobs := make(map[string][]byte, len(state.AssetHashes))
	for _, hash := range state.AssetHashes {
		if !collabAssetHashPattern.MatchString(hash) {
			continue
		}
		path := filepath.Join(p.assetDir(), hash)
		info, err := os.Stat(path)
		if err != nil || !info.Mode().IsRegular() || info.Size() > collabMaxAssetBytes {
			continue
		}
		bytes, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		blobs[hash] = bytes
	}
	p.rooms.importState(state, blobs)
	return nil
}

// flush writes pending state immediately.
func (p *Persister) flush() error {
	if !p.enabled() {
		return nil
	}
	p.mu.Lock()
	p.dirty = false
	if p.timer != nil {
		p.timer.Stop()
		p.timer = nil
	}
	closed := p.closed
	p.mu.Unlock()
	if closed {
		return nil
	}
	return p.write()
}

// write atomically replaces rooms.json.
func (p *Persister) write() error {
	payload, err := p.rooms.stateBytes()
	if err != nil {
		return err
	}
	temporary := filepath.Join(p.dir, "rooms.json.tmp")
	if err := os.WriteFile(temporary, payload, 0o600); err != nil {
		return err
	}
	if err := os.Rename(temporary, filepath.Join(p.dir, "rooms.json")); err != nil {
		return err
	}
	return nil
}

// schedule marks state dirty and arranges one debounced write.
func (p *Persister) schedule() {
	if !p.enabled() {
		return
	}
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return
	}
	p.dirty = true
	if p.timer == nil {
		p.timer = time.AfterFunc(collabPersistDelay, p.afterDelay)
	}
	p.mu.Unlock()
}

// afterDelay writes once the debounce timer fires.
func (p *Persister) afterDelay() {
	p.mu.Lock()
	p.timer = nil
	if !p.dirty || p.closed {
		p.mu.Unlock()
		return
	}
	p.dirty = false
	p.mu.Unlock()
	if err := p.write(); err != nil && p.logger != nil {
		p.logger.Printf("collaboration persistence failed: %v", err)
	}
}

// saveBlob stores one blob by hash and skips an existing file.
func (p *Persister) saveBlob(hash string, bytes []byte) error {
	if !p.enabled() || !collabAssetHashPattern.MatchString(hash) {
		return nil
	}
	path := filepath.Join(p.assetDir(), hash)
	if _, err := os.Stat(path); err == nil {
		return nil
	}
	if err := os.MkdirAll(p.assetDir(), 0o700); err != nil {
		return err
	}
	temporary := path + ".tmp"
	if err := os.WriteFile(temporary, bytes, 0o600); err != nil {
		return err
	}
	return os.Rename(temporary, path)
}

// Close stops the timer and writes the final state.
func (p *Persister) Close() error {
	if !p.enabled() {
		return nil
	}
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return nil
	}
	p.closed = true
	if p.timer != nil {
		p.timer.Stop()
		p.timer = nil
	}
	p.mu.Unlock()
	return p.write()
}
