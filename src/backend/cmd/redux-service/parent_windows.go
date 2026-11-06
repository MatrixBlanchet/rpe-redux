// Windows parent-process liveness probe, used so the sidecar exits when the
// desktop shell that started it disappears.

//go:build windows

package main

import "syscall"

// processQueryLimitedInformation is the access right needed to read an exit
// code from another process.
const processQueryLimitedInformation = 0x1000

// stillActive is the exit code Windows reports for a running process.
const stillActive = 259

// parentProcessAlive reports whether pid is still running.
func parentProcessAlive(pid int) bool {
	handle, err := syscall.OpenProcess(processQueryLimitedInformation, false, uint32(pid))
	if err != nil {
		return false
	}
	defer syscall.CloseHandle(handle)
	var exitCode uint32
	if err := syscall.GetExitCodeProcess(handle, &exitCode); err != nil {
		return false
	}
	return exitCode == stillActive
}
