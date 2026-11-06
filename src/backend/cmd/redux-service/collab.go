// Embedded room-listener startup and its health status.

package main

import (
	"fmt"
	"net"
	"strconv"

	"rperedux/server/internal/config"
	"rperedux/server/internal/httpapi"
)

// bindCollabListener binds the embedded room listener and reports the health
// contract for /api/health. A bind failure leaves the main API available and
// returns a status with OK=false so the service reports degraded instead of
// claiming full health.
func bindCollabListener(cfg *config.Config) (net.Listener, httpapi.CollabHealth) {
	status := httpapi.CollabHealth{Enabled: !cfg.CollabDisabled}
	if cfg.CollabDisabled {
		status.Error = "collaboration is disabled"
		return nil, status
	}
	addr := net.JoinHostPort(cfg.CollabHost, strconv.Itoa(cfg.CollabPort))
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		status.Error = fmt.Sprintf("collaboration listener unavailable on %s: %v", addr, err)
		return nil, status
	}
	status.OK = true
	if tcpAddr, ok := listener.Addr().(*net.TCPAddr); ok {
		status.Port = tcpAddr.Port
	}
	return listener, status
}
