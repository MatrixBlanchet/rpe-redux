// Configuration tests for the embedded collaboration listener.

package config

import (
	"path/filepath"
	"testing"
)

func TestCollabDefaultsFollowTheDatabaseDirectory(t *testing.T) {
	t.Setenv("REDUX_COLLAB_PORT", "")
	t.Setenv("REDUX_COLLAB_HOST", "")
	t.Setenv("REDUX_COLLAB_DATA", "")
	t.Setenv("REDUX_COLLAB_DISABLED", "")
	db := filepath.Join(t.TempDir(), "redux.db")
	cfg, err := Resolve([]string{"--db", db})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.CollabPort != DefaultCollabPort || cfg.CollabHost != DefaultCollabHost {
		t.Fatalf("collab defaults = %+v", cfg)
	}
	if cfg.CollabData != filepath.Join(filepath.Dir(db), "collaboration") {
		t.Fatalf("collab data = %s", cfg.CollabData)
	}
}

func TestCollabFlagsAllowEphemeralPortsAndDisable(t *testing.T) {
	cfg, err := Resolve([]string{
		"--db", filepath.Join(t.TempDir(), "redux.db"),
		"--collab-port", "0",
		"--collab-data", filepath.Join(t.TempDir(), "rooms"),
	})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.CollabPort != 0 || cfg.CollabDisabled {
		t.Fatalf("ephemeral collab = %+v", cfg)
	}
	disabled, err := Resolve([]string{"--db", filepath.Join(t.TempDir(), "redux.db"), "--no-collab"})
	if err != nil {
		t.Fatal(err)
	}
	if !disabled.CollabDisabled {
		t.Fatal("--no-collab did not disable the listener")
	}
}

func TestDevelopmentOriginsRequireTheDevFlag(t *testing.T) {
	t.Setenv("REDUX_SERVER_DEV", "")
	prod, err := Resolve([]string{"--db", filepath.Join(t.TempDir(), "redux.db")})
	if err != nil {
		t.Fatal(err)
	}
	if prod.Dev {
		t.Fatal("production config enabled development origins")
	}
	for _, origin := range prod.Origins {
		for _, dev := range DevOrigins {
			if origin == dev {
				t.Fatalf("production origins include %q", origin)
			}
		}
	}

	dev, err := Resolve([]string{"--db", filepath.Join(t.TempDir(), "redux.db"), "--dev"})
	if err != nil {
		t.Fatal(err)
	}
	if !dev.Dev {
		t.Fatal("--dev did not enable development mode")
	}
	found := false
	for _, origin := range dev.Origins {
		if origin == "http://127.0.0.1:4173" {
			found = true
		}
	}
	if !found {
		t.Fatalf("development origins = %#v", dev.Origins)
	}
}
