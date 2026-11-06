// Unix parent-process liveness probe, used so the sidecar exits when the desktop
// shell that started it disappears.

//go:build !windows

package main

import (
	"errors"
	"os"
	"syscall"
)

// parentProcessAlive reports whether pid still exists; signal 0 probes without
// delivering a signal.
func parentProcessAlive(pid int) bool {
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	if err := process.Signal(syscall.Signal(0)); err != nil {
		return !errors.Is(err, os.ErrProcessDone)
	}
	return true
}
