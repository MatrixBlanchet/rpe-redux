// Regression tests for the asset staging lease: GC must not collect a blob
// between an upload and the commit that references it.

package store

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// assertAssetCount checks how many asset rows still carry a blob hash.
func assertAssetCount(t *testing.T, store *Store, hash string, want int) {
	t.Helper()
	var count int
	if err := store.db.QueryRow(`SELECT COUNT(*) FROM assets WHERE hash = ?`, hash).Scan(&count); err != nil {
		t.Fatalf("count asset %s: %v", hash, err)
	}
	if count != want {
		t.Fatalf("asset %s count = %d, want %d", hash, count, want)
	}
}

// assertStagingLease checks the staged_at value for a blob. An empty value
// means the blob was committed and is governed only by its references.
func assertStagingLease(t *testing.T, store *Store, hash, want string) {
	t.Helper()
	var stagedAt string
	if err := store.db.QueryRow(`SELECT staged_at FROM assets WHERE hash = ?`, hash).Scan(&stagedAt); err != nil {
		t.Fatalf("read staging lease for %s: %v", hash, err)
	}
	if stagedAt != want {
		t.Fatalf("staging lease for %s = %q, want %q", hash, stagedAt, want)
	}
}

// assertStagingOwner checks which project holds the staging lease. An empty
// owner means the row was promoted or predates owner tracking.
func assertStagingOwner(t *testing.T, store *Store, hash, want string) {
	t.Helper()
	var stagedBy string
	if err := store.db.QueryRow(`SELECT staged_by FROM assets WHERE hash = ?`, hash).Scan(&stagedBy); err != nil {
		t.Fatalf("read staging owner for %s: %v", hash, err)
	}
	if stagedBy != want {
		t.Fatalf("staging owner for %s = %q, want %q", hash, stagedBy, want)
	}
}

// backdateStagingLease makes a blob look older than the GC grace period.
func backdateStagingLease(t *testing.T, store *Store, hash string) {
	t.Helper()
	expired := time.Now().UTC().Add(-assetStagingTTL - time.Minute).Format(timeLayout)
	if _, err := store.db.Exec(
		`UPDATE assets SET staged_at = ? WHERE hash = ?`, expired, hash); err != nil {
		t.Fatalf("backdate staging lease for %s: %v", hash, err)
	}
}

// TestGCKeepsFreshStagedBlobAcrossAnotherProjectDelete reproduces the original
// interleaving: project A stages an asset, another project is deleted (which
// runs GC), and only then does A commit the manifest.
func TestGCKeepsFreshStagedBlobAcrossAnotherProjectDelete(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()
	project := createTestProject(t, store)
	other := createTestProject(t, store)
	asset := stage(t, store, project.ID, "cover.png", "freshly staged bytes")

	if err := store.DeleteProject(ctx, other.ID); err != nil {
		t.Fatalf("delete competing project: %v", err)
	}
	assertAssetCount(t, store, asset.Hash, 1)

	manifest := []AssetMapping{{Name: asset.Name, Hash: asset.Hash}}
	committed, err := store.CommitProject(ctx, CommitProjectInput{
		ProjectID: project.ID,
		Chart:     testChart("with cover"),
		Assets:    &manifest,
	})
	if err != nil {
		t.Fatalf("commit after competing delete: %v", err)
	}
	if committed.Revision != project.Revision+1 {
		t.Fatalf("revision = %d, want %d", committed.Revision, project.Revision+1)
	}
	assertStagingLease(t, store, asset.Hash, "")

	// Once committed and referenced the blob is reclaimable immediately when
	// the last owner disappears.
	if err := store.DeleteProject(ctx, project.ID); err != nil {
		t.Fatalf("delete owner: %v", err)
	}
	assertAssetCount(t, store, asset.Hash, 0)
}

// TestGCKeepsFreshStagedBlobAcrossAnotherProjectCommit covers the save path:
// committing a different project must not collect another project's upload.
func TestGCKeepsFreshStagedBlobAcrossAnotherProjectCommit(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()
	project := createTestProject(t, store)
	other := createTestProject(t, store)
	asset := stage(t, store, project.ID, "cover.png", "freshly staged bytes")

	if _, err := store.CommitProject(ctx, CommitProjectInput{
		ProjectID: other.ID,
		Chart:     testChart("competing save"),
	}); err != nil {
		t.Fatalf("commit competing project: %v", err)
	}
	assertAssetCount(t, store, asset.Hash, 1)

	manifest := []AssetMapping{{Name: asset.Name, Hash: asset.Hash}}
	if _, err := store.CommitProject(ctx, CommitProjectInput{
		ProjectID: project.ID,
		Chart:     testChart("with cover"),
		Assets:    &manifest,
	}); err != nil {
		t.Fatalf("commit staged project: %v", err)
	}
}

// TestGCKeepsStagedBlobAcrossStoreInstances opens two SQLite handles over the
// same file to model two service instances sharing one library.
func TestGCKeepsStagedBlobAcrossStoreInstances(t *testing.T) {
	path := filepath.Join(t.TempDir(), "shared.db")
	first, err := Open(path)
	if err != nil {
		t.Fatalf("open first store: %v", err)
	}
	t.Cleanup(func() { _ = first.Close() })
	second, err := Open(path)
	if err != nil {
		t.Fatalf("open second store: %v", err)
	}
	t.Cleanup(func() { _ = second.Close() })

	ctx := context.Background()
	project := createTestProject(t, first)
	other := createTestProject(t, first)
	asset := stage(t, first, project.ID, "cover.png", "cross-instance bytes")

	if err := second.DeleteProject(ctx, other.ID); err != nil {
		t.Fatalf("delete from second store: %v", err)
	}
	assertAssetCount(t, first, asset.Hash, 1)

	manifest := []AssetMapping{{Name: asset.Name, Hash: asset.Hash}}
	if _, err := first.CommitProject(ctx, CommitProjectInput{
		ProjectID: project.ID,
		Chart:     testChart("with cover"),
		Assets:    &manifest,
	}); err != nil {
		t.Fatalf("commit after cross-instance delete: %v", err)
	}
}

// TestRestagingRefreshesTheLease verifies the same bytes can be uploaded again
// before their previous staging lease expires.
func TestRestagingRefreshesTheLease(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()
	project := createTestProject(t, store)
	other := createTestProject(t, store)
	asset := stage(t, store, project.ID, "cover.png", "same bytes")

	backdateStagingLease(t, store, asset.Hash)
	if restaged := stage(t, store, project.ID, "cover.png", "same bytes"); restaged.Hash != asset.Hash {
		t.Fatalf("restaged hash = %s, want %s", restaged.Hash, asset.Hash)
	}
	if err := store.DeleteProject(ctx, other.ID); err != nil {
		t.Fatalf("delete competing project: %v", err)
	}
	assertAssetCount(t, store, asset.Hash, 1)
}

// TestFailedCommitReleasesOnlyItsOwnStagedBlob verifies an aborted commit does
// not leave its upload behind, while bytes another project also staged remain
// available for that project's commit.
func TestFailedCommitReleasesOnlyItsOwnStagedBlob(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()
	project := createTestProject(t, store)
	other := createTestProject(t, store)
	asset := stage(t, store, project.ID, "cover.png", "staged for a failed save")

	stale := project.Revision + 1
	manifest := []AssetMapping{{Name: asset.Name, Hash: asset.Hash}}
	if _, err := store.CommitProject(ctx, CommitProjectInput{
		ProjectID:    project.ID,
		BaseRevision: &stale,
		Chart:        testChart("stale"),
		Assets:       &manifest,
	}); err == nil {
		t.Fatal("stale commit succeeded")
	}
	assertAssetCount(t, store, asset.Hash, 0)

	asset = stage(t, store, project.ID, "shared.png", "shared staged bytes")
	shared := stage(t, store, other.ID, "shared.png", "shared staged bytes")
	if shared.Hash != asset.Hash {
		t.Fatalf("shared hash = %s, want %s", shared.Hash, asset.Hash)
	}
	manifest = []AssetMapping{{Name: asset.Name, Hash: asset.Hash}}
	if _, err := store.CommitProject(ctx, CommitProjectInput{
		ProjectID:    project.ID,
		BaseRevision: &stale,
		Chart:        testChart("stale again"),
		Assets:       &manifest,
	}); err == nil {
		t.Fatal("stale shared commit succeeded")
	}
	assertAssetCount(t, store, shared.Hash, 1)
	assertStagingOwner(t, store, shared.Hash, other.ID)

	otherManifest := []AssetMapping{{Name: shared.Name, Hash: shared.Hash}}
	if _, err := store.CommitProject(ctx, CommitProjectInput{
		ProjectID: other.ID,
		Chart:     testChart("shared after failed save"),
		Assets:    &otherManifest,
	}); err != nil {
		t.Fatalf("commit shared asset: %v", err)
	}
	assertStagingLease(t, store, shared.Hash, "")
	assertStagingOwner(t, store, shared.Hash, "")
}

// TestConcurrentStageCommitAndGC runs staging, commits, and collection sweeps
// for two projects on one library. A save must never lose its just-staged bytes
// to another project's commit or delete.
func TestConcurrentStageCommitAndGC(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()
	owner := createTestProject(t, store)
	for index := 0; index < 12; index++ {
		asset := stage(t, store, owner.ID, fmt.Sprintf("asset-%02d.bin", index),
			fmt.Sprintf("payload-%02d", index))
		manifest := []AssetMapping{{Name: asset.Name, Hash: asset.Hash}}
		temporary := createTestProject(t, store)

		start := make(chan struct{})
		results := make(chan error, 2)
		go func() {
			<-start
			results <- store.DeleteProject(ctx, temporary.ID)
		}()
		go func() {
			<-start
			_, err := store.CommitProject(ctx, CommitProjectInput{
				ProjectID: owner.ID,
				Chart:     testChart(fmt.Sprintf("concurrent %d", index)),
				Assets:    &manifest,
			})
			results <- err
		}()
		close(start)
		for attempt := 0; attempt < 2; attempt++ {
			if err := <-results; err != nil {
				t.Fatalf("concurrent write %d: %v", index, err)
			}
		}
	}
}

// TestGCReclaimsExpiredStagedBlob verifies an abandoned upload does not leak
// and that a commit after expiry still reports the unknown blob.
func TestGCReclaimsExpiredStagedBlob(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()
	project := createTestProject(t, store)
	other := createTestProject(t, store)
	asset := stage(t, store, project.ID, "abandoned.png", "abandoned bytes")

	backdateStagingLease(t, store, asset.Hash)
	if err := store.DeleteProject(ctx, other.ID); err != nil {
		t.Fatalf("delete competing project: %v", err)
	}
	assertAssetCount(t, store, asset.Hash, 0)

	manifest := []AssetMapping{{Name: asset.Name, Hash: asset.Hash}}
	_, err := store.CommitProject(ctx, CommitProjectInput{
		ProjectID: project.ID,
		Chart:     testChart("expired"),
		Assets:    &manifest,
	})
	if err == nil || !strings.Contains(err.Error(), "unknown blob") {
		t.Fatalf("commit after expiry error = %v, want unknown blob", err)
	}
}

// TestReferencedBlobSurvivesExpiredStagingLease verifies references outrank
// the lease: an old lease cannot make a chart's committed bytes collectable.
func TestReferencedBlobSurvivesExpiredStagingLease(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()
	project := createTestProject(t, store)
	other := createTestProject(t, store)
	asset := stage(t, store, project.ID, "song.ogg", "committed bytes")
	manifest := []AssetMapping{{Name: asset.Name, Hash: asset.Hash}}
	if _, err := store.CommitProject(ctx, CommitProjectInput{
		ProjectID: project.ID,
		Chart:     testChart("song"),
		Assets:    &manifest,
	}); err != nil {
		t.Fatalf("commit: %v", err)
	}

	backdateStagingLease(t, store, asset.Hash)
	if err := store.DeleteProject(ctx, other.ID); err != nil {
		t.Fatalf("delete competing project: %v", err)
	}
	assertAssetCount(t, store, asset.Hash, 1)

	assets, err := store.ListProjectAssets(ctx, project.ID)
	if err != nil {
		t.Fatalf("list assets: %v", err)
	}
	if len(assets) != 1 || assets[0].Hash != asset.Hash {
		t.Fatalf("assets = %#v, want the committed blob", assets)
	}
}

// TestOpenAddsStagingColumnToExistingLibrary verifies the additive schema
// migration: an a5 database gains staged_at, inherits created_at, and reopens
// without changing the value again.
func TestOpenAddsStagingColumnToExistingLibrary(t *testing.T) {
	path := filepath.Join(t.TempDir(), "legacy.db")
	raw, err := sql.Open("sqlite", path)
	if err != nil {
		t.Fatalf("open legacy database: %v", err)
	}
	const created = "2026-01-02T03:04:05Z"
	if _, err := raw.Exec(`
        CREATE TABLE assets (
            hash       TEXT PRIMARY KEY,
            size       INTEGER NOT NULL,
            bytes      BLOB NOT NULL,
            created_at TEXT NOT NULL
        );
        INSERT INTO assets (hash, size, bytes, created_at)
        VALUES ('legacy', 3, X'010203', ?)`, created); err != nil {
		_ = raw.Close()
		t.Fatalf("create legacy assets table: %v", err)
	}
	if err := raw.Close(); err != nil {
		t.Fatalf("close legacy database: %v", err)
	}

	store, err := Open(path)
	if err != nil {
		t.Fatalf("open migrated store: %v", err)
	}
	t.Cleanup(func() { _ = store.Close() })
	assertStagingLease(t, store, "legacy", created)
	assertStagingOwner(t, store, "legacy", "")

	if err := store.Close(); err != nil {
		t.Fatalf("close migrated store: %v", err)
	}
	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen migrated store: %v", err)
	}
	t.Cleanup(func() { _ = reopened.Close() })
	assertStagingLease(t, reopened, "legacy", created)
	assertStagingOwner(t, reopened, "legacy", "")
}
