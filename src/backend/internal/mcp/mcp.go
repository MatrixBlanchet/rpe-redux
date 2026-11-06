// Loopback MCP transport and code-cell HTTP routes. External JSON-RPC clients
// connect to the local endpoint and are routed to the active editor over a
// private WebSocket bridge authenticated by a per-process token. The stored
// mcp-enabled preference is the write-consent boundary; the transport accepts
// loopback requests only and leaves chart data with the editor. Code-cell routes
// additionally require the service to be bound to a loopback address; the
// requested cell profile decides whether a run may write.

package mcp

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"rperedux/server/internal/ws"
)

// Transport limits and the protocol revision this build implements.
const (
	mcpMaxBody    = 4 << 20
	mcpRequestTTL = 30 * time.Second
	// The newest protocol this transport implements. Initialize negotiates down
	// to the client's version when the client names one we also support.
	mcpProtocolLatest = "2025-06-18"

	// The editor bridge is authenticated by a per-process session token. The
	// frontend reads it from an endpoint file beside the SQLite database; it is
	// never exposed over unauthenticated HTTP.
	mcpEndpointFileName = "mcp-endpoint.json"
	mcpEndpointVersion  = 1
	BridgePath          = "/api/mcp/bridge"
)

// Version is the product version reported by MCP initialize. The sidecar entry
// point sets it from the linker-injected build version before serving.
var Version = "dev"

// mcpProtocols lists the protocol revisions the transport accepts, newest
// first.
var mcpProtocols = []string{"2025-06-18", "2025-03-26", "2024-11-05"}

// mcpTool describes one exposed tool and the editor method it forwards to.
// Keeping the name, schema, annotations, and method together keeps the public
// list and the dispatcher in sync.
type mcpTool struct {
	name        string
	title       string
	method      string
	description string
	readOnly    bool
	inputSchema map[string]any
}

// mcpEndpoint is the on-disk handshake record the desktop frontend reads before
// it opens the editor bridge. The token is regenerated for every sidecar
// process and is only written to the user's data directory.
type mcpEndpoint struct {
	Version int    `json:"version"`
	Token   string `json:"token"`
	Bridge  string `json:"bridge"`
}

// mcpBridgeCredential caches the random session token generated for this
// process. A failed generation is cached too so the bridge fails closed.
var mcpBridgeCredential struct {
	once  sync.Once
	token string
	err   error
}

// mcpBridgeToken returns the current process's editor-bridge token.
func mcpBridgeToken() (string, error) {
	mcpBridgeCredential.once.Do(func() {
		raw := make([]byte, 32)
		if _, err := rand.Read(raw); err != nil {
			mcpBridgeCredential.err = err
			return
		}
		mcpBridgeCredential.token = base64.RawURLEncoding.EncodeToString(raw)
	})
	return mcpBridgeCredential.token, mcpBridgeCredential.err
}

// EnsureEndpoint writes the bridge handshake file beside the database and
// returns its absolute path. The file is replaced on every process start, so a
// stale file from an earlier sidecar cannot authorize a new bridge.
func EnsureEndpoint(dbPath string) (string, error) {
	token, err := mcpBridgeToken()
	if err != nil {
		return "", fmt.Errorf("generate MCP bridge token: %w", err)
	}
	absolute, err := filepath.Abs(dbPath)
	if err != nil {
		return "", err
	}
	path := filepath.Join(filepath.Dir(absolute), mcpEndpointFileName)
	payload, err := json.Marshal(mcpEndpoint{
		Version: mcpEndpointVersion,
		Token:   token,
		Bridge:  BridgePath,
	})
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(path, append(payload, '\n'), 0o600); err != nil {
		return "", err
	}
	// Enforce the mode when the file already existed with broader permissions.
	_ = os.Chmod(path, 0o600)
	return path, nil
}

// Server multiplexes MCP JSON-RPC and code-cell routes over one editor
// bridge.
type Server struct {
	mu      sync.Mutex
	bridge  *ws.Conn
	pending map[string]chan map[string]any
	nextID  uint64
	// cellLoopback is fixed at startup from the listener address. It must not be
	// derived from the request: http.LocalAddrContextKey reports the accepted
	// connection's local endpoint, so a wildcard listener still looks like
	// 127.0.0.1 to a local client.
	cellLoopback bool
}

// NewServer returns a server with an empty pending-request map.
func NewServer() *Server {
	return &Server{pending: make(map[string]chan map[string]any)}
}

// ServeHTTP routes the MCP and code-cell paths and applies the shared transport
// guards before dispatch.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/api/mcp/bridge":
		s.handleBridge(w, r)
		return
	case "/api/cell/guide":
		s.handleCellGuide(w, r)
		return
	case "/api/cell/run":
		s.handleCellRun(w, r)
		return
	case "/api/mcp":
		// The MCP JSON-RPC route continues below.
	default:
		http.NotFound(w, r)
		return
	}
	if !LoopbackRequest(r) {
		http.Error(w, "MCP is available on loopback only", http.StatusForbidden)
		return
	}
	if !OriginAllowed(r) {
		writeMCPHTTPError(w, http.StatusForbidden, -32000, "MCP rejects browser origins")
		return
	}
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || (mediaType != "" && mediaType != "application/json") {
		writeMCPHTTPError(w, http.StatusUnsupportedMediaType, -32600, "MCP requires JSON")
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, mcpMaxBody+1))
	if err != nil || len(body) > mcpMaxBody {
		writeMCPHTTPError(w, http.StatusRequestEntityTooLarge, -32600, "MCP request is too large")
		return
	}
	var request map[string]any
	if err := json.Unmarshal(body, &request); err != nil || request == nil {
		writeMCPHTTPError(w, http.StatusBadRequest, -32700, "MCP request must be JSON")
		return
	}
	response, notification := s.dispatch(request)
	if notification {
		w.WriteHeader(http.StatusAccepted)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response)
}

// LoopbackRequest keeps the endpoint local even when the sidecar is bound to
// a LAN interface for collaboration rooms.
func LoopbackRequest(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return false
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// OriginAllowed accepts native clients (no Origin) and the Tauri shell. A
// browser page carries a foreign Origin and is rejected before any RPC runs.
func OriginAllowed(r *http.Request) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	return origin == "" || origin == "http://tauri.localhost" || origin == "https://tauri.localhost"
}

// RestrictCellsToListener records whether the main listener is loopback-only
// and therefore may expose code-cell routes. It reports the resulting state for
// the startup warning.
func (s *Server) RestrictCellsToListener(addr net.Addr) bool {
	s.cellLoopback = addrIsLoopback(addr)
	return s.cellLoopback
}

// addrIsLoopback reports whether a listener address is loopback-only. It is
// evaluated once at startup because the listen address is the only reliable
// wildcard check.
func addrIsLoopback(addr net.Addr) bool {
	tcp, ok := addr.(*net.TCPAddr)
	return ok && tcp.IP.IsLoopback()
}

// cellAccessAllowed is stricter than the MCP route: the listener and the peer
// must both be loopback. A sidecar started with --host 0.0.0.0 therefore exposes
// no code-cell endpoint, even to other processes on the same machine.
func (s *Server) cellAccessAllowed(r *http.Request) bool {
	return s.cellLoopback && LoopbackRequest(r) && OriginAllowed(r)
}

// cellHTTPStatus maps a code-cell failure to the HTTP status of the local
// service. Cell outcomes that remain inside a successful envelope, such as a
// syntax or capability error, never pass through this table.
func cellHTTPStatus(code string) int {
	switch code {
	case "disabled":
		return http.StatusForbidden
	case "conflict", "stale_read", "busy", "cancelled":
		return http.StatusConflict
	case "timeout":
		return http.StatusGatewayTimeout
	case "runtime", "unavailable":
		return http.StatusServiceUnavailable
	case "failed":
		return http.StatusInternalServerError
	default:
		return http.StatusBadRequest
	}
}

// writeCellHTTPError writes the code-cell error envelope, keeping structured
// details and the current revisions when the editor supplied them.
func writeCellHTTPError(
	w http.ResponseWriter,
	status int,
	code string,
	message string,
	details any,
	revisions any,
) {
	errorRecord := map[string]any{
		"code":    code,
		"message": message,
	}
	if details != nil {
		errorRecord["details"] = details
	}
	payload := map[string]any{
		"ok":    false,
		"error": errorRecord,
	}
	if revisions != nil {
		payload["revisions"] = revisions
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// handleCellGuide serves the same guide the MCP code.guide tool returns. The
// guide is fetched before a cell runs, so it requires neither a chart nor an
// enabled MCP or code-execution setting; the bridge answers it directly.
func (s *Server) handleCellGuide(w http.ResponseWriter, r *http.Request) {
	if !s.cellAccessAllowed(r) {
		writeCellHTTPError(w, http.StatusForbidden, "loopback_required",
			"Code cell API is loopback-only; bind the service to 127.0.0.1", nil, nil)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	response, err := s.forward(map[string]any{"method": "cell.guide"})
	if err != nil {
		writeCellHTTPError(w, http.StatusServiceUnavailable, "unavailable", err.Error(), nil, nil)
		return
	}
	value, _ := response["value"].(map[string]any)
	text, _ := value["text"].(string)
	ok, _ := response["ok"].(bool)
	if !ok || strings.TrimSpace(text) == "" {
		writeCellHTTPError(w, http.StatusServiceUnavailable, "unavailable",
			"The editor did not provide the code-cell guide", nil, nil)
		return
	}
	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusOK)
		return
	}
	_, _ = io.WriteString(w, text)
}

// handleCellRun forwards one code-cell request to the mounted editor. The
// adapter validates the requested profile and the runtime enforces the
// code-execution setting; this route never applies a transaction itself.
func (s *Server) handleCellRun(w http.ResponseWriter, r *http.Request) {
	if !s.cellAccessAllowed(r) {
		writeCellHTTPError(w, http.StatusForbidden, "loopback_required",
			"Code cell API is loopback-only; bind the service to 127.0.0.1", nil, nil)
		return
	}
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || (mediaType != "" && mediaType != "application/json") {
		writeCellHTTPError(w, http.StatusUnsupportedMediaType, "invalid_request",
			"Code cell requests require JSON", nil, nil)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, mcpMaxBody+1))
	if err != nil || len(body) > mcpMaxBody {
		writeCellHTTPError(w, http.StatusRequestEntityTooLarge, "invalid_request",
			"Code cell request is too large", nil, nil)
		return
	}
	var params map[string]any
	if err := json.Unmarshal(body, &params); err != nil || params == nil {
		writeCellHTTPError(w, http.StatusBadRequest, "invalid_request",
			"Code cell request must be a JSON object", nil, nil)
		return
	}
	response, err := s.forward(map[string]any{"method": "cell.run", "params": params})
	if err != nil {
		writeCellHTTPError(w, http.StatusServiceUnavailable, "unavailable", err.Error(), nil, nil)
		return
	}
	if ok, _ := response["ok"].(bool); !ok {
		code := "failed"
		message := "The editor rejected the code cell"
		var details any
		if errorRecord, ok := response["error"].(map[string]any); ok {
			if value, ok := errorRecord["code"].(string); ok && value != "" {
				code = value
			}
			if value, ok := errorRecord["message"].(string); ok && value != "" {
				message = value
			}
			details = errorRecord["details"]
		}
		writeCellHTTPError(w, cellHTTPStatus(code), code, message, details, response["revisions"])
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(response["value"])
}

// bridgeTokenValid compares a supplied bridge token with the process token
// without leaking timing information.
func (s *Server) bridgeTokenValid(r *http.Request) bool {
	expected, err := mcpBridgeToken()
	if err != nil || expected == "" {
		return false
	}
	supplied := r.URL.Query().Get("token")
	if supplied == "" {
		const bearer = "Bearer "
		if authorization := r.Header.Get("Authorization"); strings.HasPrefix(authorization, bearer) {
			supplied = strings.TrimSpace(strings.TrimPrefix(authorization, bearer))
		}
	}
	return subtle.ConstantTimeCompare([]byte(supplied), []byte(expected)) == 1
}

// handleBridge accepts the authenticated editor WebSocket, replaces any
// previous bridge, and relays responses to the waiters they belong to.
func (s *Server) handleBridge(w http.ResponseWriter, r *http.Request) {
	if !LoopbackRequest(r) || !OriginAllowed(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if !s.bridgeTokenValid(r) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	socket, err := ws.Upgrade(w, r)
	if err != nil {
		return
	}
	s.mu.Lock()
	previous := s.bridge
	s.bridge = socket
	// A replacement bridge is a new editor mount; release outstanding waiters
	// immediately because the old socket cannot answer them.
	for id, waiter := range s.pending {
		delete(s.pending, id)
		waiter <- nil
	}
	s.mu.Unlock()
	if previous != nil {
		previous.Close()
	}
	defer func() {
		s.mu.Lock()
		if s.bridge == socket {
			s.bridge = nil
			for id, waiter := range s.pending {
				delete(s.pending, id)
				waiter <- nil
			}
		}
		s.mu.Unlock()
		socket.Close()
	}()
	for {
		payload, err := socket.ReadMessage()
		if err != nil {
			return
		}
		var message map[string]any
		if err := json.Unmarshal(payload, &message); err != nil {
			continue
		}
		if stringField(message, "type") != "response" {
			continue
		}
		id := stringField(message, "id")
		s.mu.Lock()
		waiter := s.pending[id]
		delete(s.pending, id)
		s.mu.Unlock()
		if waiter != nil {
			waiter <- message
		}
	}
}

// dispatch answers protocol methods locally and forwards tool calls to the
// editor. Notifications return no response.
func (s *Server) dispatch(request map[string]any) (map[string]any, bool) {
	id, hasID := request["id"]
	method := stringField(request, "method")
	if !hasID {
		return nil, true
	}
	switch method {
	case "initialize":
		params, _ := request["params"].(map[string]any)
		return mcpRPCResult(id, map[string]any{
			"protocolVersion": mcpNegotiateProtocol(params),
			"capabilities": map[string]any{
				"tools": map[string]any{"listChanged": false},
			},
			"serverInfo": map[string]any{
				"name":    "rpe-redux",
				"title":   "RPE Redux",
				"version": Version,
			},
			"instructions": "Read and edit the chart open in the RPE Redux desktop editor. " +
				"Chart writes require the current chart fingerprint and respect the active room role. " +
				"An applied transaction changes the open editor session only; it never rewrites the chart file. " +
				"Read redux_document_state for revisions.chartFingerprint and redux_chart_read for metadata, " +
				"line, note and event values before writing; the metadata collection carries META.name, song, " +
				"offset and the rest of the chart header. Beats are reduced [whole, numerator, denominator] " +
				"triples ([3,1,2] is 3.5); note types are 1 tap, 2 hold, 3 flick, 4 drag; positionX spans " +
				"-675..675. The redux_chart_apply and redux_chart_validate input schemas document the full " +
				"transaction grammar; transactions can replace timing.bpmList, insert or patch judge lines, and " +
				"insert/update/delete notes and events, but cannot delete judge lines. For multi-step reads or " +
				"computed proposals, call redux_code_guide and then redux_code_run with a short JavaScript cell. " +
				"The cell can return {summary, transaction} for the existing validate/apply tools.",
		}), false
	case "ping":
		return mcpRPCResult(id, map[string]any{}), false
	case "tools/list":
		return mcpRPCResult(id, map[string]any{"tools": mcpToolDefinitions()}), false
	case "tools/call":
		params, _ := request["params"].(map[string]any)
		name := stringField(params, "name")
		tool, ok := mcpToolByName[name]
		if !ok {
			return mcpRPCError(id, -32602, "Unknown tool: "+name, nil), false
		}
		arguments, _ := params["arguments"].(map[string]any)
		forwarded := map[string]any{"method": tool.method}
		if len(arguments) > 0 {
			forwarded["params"] = arguments
		}
		response, err := s.forward(forwarded)
		if err != nil {
			return mcpToolError(id, err.Error()), false
		}
		return mcpToolResult(id, response), false
	}
	return mcpRPCError(id, -32601, "Method not found", nil), false
}

// stringField returns a string field, or "" when absent or mistyped.
func stringField(message map[string]any, key string) string {
	value, _ := message[key].(string)
	return value
}

// mcpNegotiateProtocol echoes a protocol revision both sides support and
// otherwise offers the newest.
func mcpNegotiateProtocol(params map[string]any) string {
	requested, _ := params["protocolVersion"].(string)
	for _, supported := range mcpProtocols {
		if requested == supported {
			return requested
		}
	}
	return mcpProtocolLatest
}

// forward sends one request over the bridge and waits up to mcpRequestTTL for
// its response.
func (s *Server) forward(request map[string]any) (map[string]any, error) {
	s.mu.Lock()
	bridge := s.bridge
	if bridge == nil {
		s.mu.Unlock()
		return nil, fmt.Errorf("no editor is connected; enable MCP in Settings and open a chart")
	}
	s.nextID++
	id := strconv.FormatUint(s.nextID, 10)
	waiter := make(chan map[string]any, 1)
	s.pending[id] = waiter
	s.mu.Unlock()
	payload, err := json.Marshal(map[string]any{"type": "request", "id": id, "request": request})
	if err != nil {
		s.removePending(id)
		return nil, err
	}
	if err := bridge.WriteText(payload); err != nil {
		s.removePending(id)
		return nil, fmt.Errorf("editor bridge is unavailable")
	}
	select {
	case message := <-waiter:
		if message == nil {
			return nil, fmt.Errorf("editor bridge closed")
		}
		response, _ := message["response"].(map[string]any)
		if response == nil {
			return nil, fmt.Errorf("editor returned an invalid response")
		}
		return response, nil
	case <-time.After(mcpRequestTTL):
		s.removePending(id)
		return nil, fmt.Errorf("editor did not answer within %s", mcpRequestTTL)
	}
}

// removePending drops a waiter that can no longer be answered.
func (s *Server) removePending(id string) {
	s.mu.Lock()
	delete(s.pending, id)
	s.mu.Unlock()
}

// CloseAll closes the editor bridge and releases every pending waiter.
func (s *Server) CloseAll() {
	s.mu.Lock()
	bridge := s.bridge
	s.bridge = nil
	pending := s.pending
	s.pending = make(map[string]chan map[string]any)
	s.mu.Unlock()
	if bridge != nil {
		bridge.Close()
	}
	for _, waiter := range pending {
		waiter <- nil
	}
}

// mcpToolList is the ordered tool catalog exposed to clients.
var mcpToolList = []mcpTool{
	{
		name:   "redux_document_state",
		title:  "Document state",
		method: "document.state",
		description: "Read the active document without changing it. Call this first and after every write or " +
			"conflict. Returns lifecycle (closed, opening, open), operation (idle, rescan, applying, saving), " +
			"source (unknown, synced, external-pending, conflict), dirty, name (document/file name), title " +
			"(chart META.name, the same name the editor window shows), path (absolute file path or null for a " +
			"new or library document), format (memory, json, pez), and revisions " +
			"{chartFingerprint, diskSnapshot, generation}. Use revisions.chartFingerprint as the base for " +
			"redux_chart_apply and pass it to reads or validation when the result must match the current revision. " +
			"Takes no arguments.",
		readOnly:    true,
		inputSchema: mcpSchemaObject(map[string]any{}),
	},
	{
		name:   "redux_chart_read",
		title:  "Read chart",
		method: "chart.read",
		description: "Read one page of chart data. Use it to inspect current values and collect the ids needed " +
			"by redux_chart_apply. `metadata` returns [META] with the chart name, song, background, offset and " +
			"other header fields; check it before a metadata write and pair it with redux_document_state to " +
			"confirm the target document. `lines` returns judge lines; a line's numOfNotes is a derived scoring " +
			"count that excludes Holds (type 2). `notes` returns {id, lineId, lineIndex, index, note} references; " +
			"`events` returns {id, lineId, lineIndex, eventType, layer, index, event} references. " +
			"BPMList is part of the chart snapshot, not one of these pages; call redux_code_run when timing " +
			"must be read before a timing write. Paging: `limit` defaults to 50 and is capped at 100; pass " +
			"`nextCursor` back as `cursor` until it is null. Cursors pin the chart fingerprint and generation, " +
			"so any edit invalidates them. Pass `chartFingerprint` to fail instead of reading a different " +
			"revision. A stale or malformed cursor is returned as an isError result.",
		readOnly:    true,
		inputSchema: mcpChartReadInputSchema(),
	},
	{
		name:   "redux_chart_validate",
		title:  "Validate chart transaction",
		method: "chart.validate",
		description: "Dry-run a chart transaction without committing it. Returns status (previewed, unchanged, " +
			"rejected, unavailable), affectedObjectIds and issues. It does not retain a preview and returns no " +
			"previewId; pass the same request to redux_chart_apply. Use it before apply for multi-operation edits " +
			"or when field names are uncertain. `expected` may pin chartFingerprint, diskSnapshot, or generation; " +
			"a mismatch returns stale_read. `request` is the same grammar described by `$defs.chartTransaction` " +
			"in this tool's input schema and in redux_chart_apply.",
		readOnly:    true,
		inputSchema: mcpChartValidateInputSchema(),
	},
	{
		name:   "redux_code_guide",
		title:  "Code cell SDK guide",
		method: "code.guide",
		description: "Return the compact RPE Redux code-cell SDK guide: the async redux handles, chart data shapes, " +
			"beat triples, limits, and the transaction proposal convention. Call this once before writing a " +
			"redux_code_run cell, then keep the returned text in context. It takes no arguments and changes nothing.",
		readOnly:    true,
		inputSchema: mcpSchemaObject(map[string]any{}),
	},
	{
		name:   "redux_code_run",
		title:  "Run code cell",
		method: "code.run",
		description: "Run one JavaScript cell against the editor SDK. The cell receives `redux` and `input`, " +
			"may loop and compute, and returns a JSON value. It can apply chart transactions and add or remove " +
			"project assets, but cannot save, open, close, or delete documents or projects, use the network, or " +
			"access the DOM. The separate code-execution Settings toggle must be enabled. Use redux_code_guide " +
			"first, read redux_document_state for revisions, then call redux.transaction.apply in the cell. The " +
			"result includes logs, duration, start/end revisions, and a source-adjusted code-cell error. Timeout " +
			"defaults to 10 seconds and is capped at 20 seconds.",
		readOnly:    false,
		inputSchema: mcpCodeRunInputSchema(),
	},
	{
		name:   "redux_chart_apply",
		title:  "Apply chart transaction",
		method: "chart.apply",
		description: "Commit one atomic chart transaction to the active document. This and redux_code_run are the write paths. " +
			"Workflow: read redux_document_state for revisions and the target document, read the chart metadata " +
			"and objects with redux_chart_read, read BPMList with redux_code_run when changing timing, optionally " +
			"dry-run with redux_chart_validate, then call this tool " +
			"with the same `request` and the current `expectedChartFingerprint`. A stale fingerprint or generation " +
			"is rejected as a conflict; re-read and retry. In a collaboration room the active role must allow " +
			"writes. An applied transaction changes the open editor session only; it does not save or rewrite the " +
			"chart file. Transaction rules: `metadata` patches META; `timing.bpmList` replaces the complete " +
			"tempo map and is sorted by beat; `lines.insert` appends a judge line and `lines.update` patches " +
			"editable fields of existing judge lines; `notes` and `events` insert/update/delete by line or object " +
			"id. Judge lines cannot be deleted through a transaction. Times are reduced beat triples " +
			"[whole, numerator, denominator], not seconds. Inserts may omit `id`; the editor assigns a " +
			"UUID-shaped id. Line structural fields (id, notes, eventLayers, extended, numOfNotes) cannot be " +
			"patched; use the notes and events operations instead. numOfNotes is derived and excludes Holds " +
			"(type 2), so it is not the length of the notes array. The `$defs.chartTransaction` entry in this " +
			"tool's input schema documents every field. Returns status (committed or unchanged), " +
			"beforeFingerprint, afterFingerprint, affectedObjectIds, issues, history and conflict; history.origin " +
			"echoes the supplied clientId/requestId audit fields. A stale base or rejection is an isError result.",
		inputSchema: mcpChartApplyInputSchema(),
	},
}

// mcpToolByName indexes the catalog for tool dispatch.
var mcpToolByName = func() map[string]mcpTool {
	tools := make(map[string]mcpTool, len(mcpToolList))
	for _, tool := range mcpToolList {
		tools[tool.name] = tool
	}
	return tools
}()

// mcpToolDefinitions renders the catalog in the MCP tools/list shape.
func mcpToolDefinitions() []map[string]any {
	tools := make([]map[string]any, 0, len(mcpToolList))
	for _, tool := range mcpToolList {
		annotations := map[string]any{
			"readOnlyHint":    tool.readOnly,
			"destructiveHint": !tool.readOnly,
			"idempotentHint":  tool.readOnly,
			"openWorldHint":   false,
		}
		tools = append(tools, map[string]any{
			"name":        tool.name,
			"title":       tool.title,
			"description": tool.description,
			"inputSchema": tool.inputSchema,
			"annotations": annotations,
		})
	}
	return tools
}

// mcpRPCResult wraps a successful JSON-RPC result.
func mcpRPCResult(id any, result any) map[string]any {
	return map[string]any{"jsonrpc": "2.0", "id": id, "result": result}
}

// mcpRPCError wraps a JSON-RPC error, adding data when present.
func mcpRPCError(id any, code int, message string, data any) map[string]any {
	error := map[string]any{"code": code, "message": message}
	if data != nil {
		error["data"] = data
	}
	return map[string]any{"jsonrpc": "2.0", "id": id, "error": error}
}

// mcpToolResult converts an editor response into MCP content and maps a failure
// to an isError result. Failures carry the adapter's code, message, details,
// and current revisions in structuredContent, and keep a readable text block
// plus a JSON fallback for clients that do not read structured output.
func mcpToolResult(id any, response map[string]any) map[string]any {
	if ok, _ := response["ok"].(bool); !ok {
		errorRecord, _ := response["error"].(map[string]any)
		if errorRecord == nil {
			errorRecord = map[string]any{"code": "failed"}
		}
		code := stringField(errorRecord, "code")
		message := stringField(errorRecord, "message")
		if message == "" {
			if code != "" {
				message = "MCP request failed: " + code
			} else {
				message = "The editor rejected the MCP request"
			}
		}
		// The top-level fields let a model branch on one object; `error` keeps
		// the exact adapter envelope for clients that already unwrap it.
		structured := map[string]any{
			"code":      code,
			"message":   message,
			"details":   nil,
			"revisions": nil,
			"error":     errorRecord,
		}
		if details, ok := errorRecord["details"]; ok {
			structured["details"] = details
		}
		if revisions, ok := response["revisions"]; ok {
			structured["revisions"] = revisions
		}
		encoded, _ := json.Marshal(structured)
		return mcpRPCResult(id, map[string]any{
			"content": []map[string]any{
				{"type": "text", "text": message},
				{"type": "text", "text": string(encoded)},
			},
			"structuredContent": structured,
			"isError":           true,
		})
	}
	value := response["value"]
	encoded, _ := json.Marshal(value)
	return mcpRPCResult(id, map[string]any{
		"content":           []map[string]any{{"type": "text", "text": string(encoded)}},
		"structuredContent": value,
		"isError":           false,
	})
}

// mcpToolError returns an isError tool result for a transport-level editor
// failure, such as no connected bridge.
func mcpToolError(id any, message string) map[string]any {
	structured := map[string]any{
		"code":      "unavailable",
		"message":   message,
		"details":   nil,
		"revisions": nil,
		"error":     map[string]any{"code": "unavailable", "message": message},
	}
	encoded, _ := json.Marshal(structured)
	return mcpRPCResult(id, map[string]any{
		"content": []map[string]any{
			{"type": "text", "text": message},
			{"type": "text", "text": string(encoded)},
		},
		"structuredContent": structured,
		"isError":           true,
	})
}

// writeMCPHTTPError writes a JSON-RPC error for transport-level failures.
func writeMCPHTTPError(w http.ResponseWriter, status int, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"jsonrpc": "2.0",
		"error":   map[string]any{"code": code, "message": message},
		"id":      nil,
	})
}
