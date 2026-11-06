// Parent-process liveness monitoring for the sidecar.

package main

import (
	"os"
	"strconv"
	"time"
)

// configuredParentPID reads REDUX_PARENT_PID and reports whether it names a
// positive process id.
func configuredParentPID() (int, bool) {
	value := os.Getenv("REDUX_PARENT_PID")
	if value == "" {
		return 0, false
	}
	pid, err := strconv.Atoi(value)
	return pid, err == nil && pid > 0
}

// watchParent signals exited once pid disappears, or returns when done closes.
func watchParent(pid int, exited chan<- struct{}, done <-chan struct{}) {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-done:
			return
		case <-ticker.C:
			if !parentProcessAlive(pid) {
				exited <- struct{}{}
				return
			}
		}
	}
}
