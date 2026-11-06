// Tests for the self-describing MCP tool catalogue. The descriptions and input
// schemas are the public usage contract for external agents, so they must carry
// enough detail to build a transaction without reading the TypeScript source.
package mcp

import (
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func mcpText(value any) string {
	text, _ := value.(string)
	return text
}

func mcpList(value any) []string {
	switch typed := value.(type) {
	case []string:
		return typed
	case []any:
		out := make([]string, 0, len(typed))
		for _, entry := range typed {
			if text, ok := entry.(string); ok {
				out = append(out, text)
			}
		}
		return out
	}
	return nil
}

func mcpProperties(t *testing.T, schema map[string]any, path string) map[string]any {
	t.Helper()
	properties, ok := schema["properties"].(map[string]any)
	if !ok {
		t.Fatalf("%s has no properties object", path)
	}
	return properties
}

func mcpRequired(t *testing.T, schema map[string]any) []string {
	t.Helper()
	return mcpList(schema["required"])
}

func mcpHas(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}

func TestMCPCellAccessRequiresLoopbackListenerAndPeer(t *testing.T) {
	request := func(remote, origin string) *http.Request {
		r := httptest.NewRequest(http.MethodGet, "/api/cell/guide", nil)
		r.RemoteAddr = remote
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		return r
	}
	loopback := &Server{cellLoopback: true}
	wildcard := &Server{cellLoopback: false}

	if !loopback.cellAccessAllowed(request("127.0.0.1:5000", "")) {
		t.Error("a loopback listener and peer should be accepted")
	}
	if wildcard.cellAccessAllowed(request("127.0.0.1:5000", "")) {
		t.Error("a wildcard listener must not expose code cells")
	}
	if loopback.cellAccessAllowed(request("10.0.0.2:5000", "")) {
		t.Error("a non-loopback peer must not reach code cells")
	}
	if loopback.cellAccessAllowed(request("127.0.0.1:5000", "https://example.com")) {
		t.Error("a browser origin must not reach code cells")
	}
}

func TestAddrIsLoopbackRejectsWildcardAddrs(t *testing.T) {
	if !addrIsLoopback(&net.TCPAddr{IP: net.ParseIP("127.0.0.1")}) {
		t.Error("127.0.0.1 should be loopback")
	}
	if !addrIsLoopback(&net.TCPAddr{IP: net.ParseIP("::1")}) {
		t.Error("::1 should be loopback")
	}
	if addrIsLoopback(&net.TCPAddr{IP: net.IPv4zero}) {
		t.Error("0.0.0.0 must not be loopback")
	}
	if addrIsLoopback(&net.TCPAddr{}) {
		t.Error("an unspecified address must not be loopback")
	}
}

func TestMCPToolsDescribeTheirUsage(t *testing.T) {
	definitions := mcpToolDefinitions()
	if len(definitions) != len(mcpToolList) {
		t.Fatalf("definition count = %d, want %d", len(definitions), len(mcpToolList))
	}
	seen := make(map[string]bool, len(definitions))
	for _, definition := range definitions {
		name := mcpText(definition["name"])
		if name == "" {
			t.Fatal("a tool definition has no name")
		}
		if seen[name] {
			t.Fatalf("duplicate tool definition: %s", name)
		}
		seen[name] = true
		if mcpText(definition["title"]) == "" {
			t.Errorf("%s has no title", name)
		}
		description := mcpText(definition["description"])
		if len(description) < 120 {
			t.Errorf("%s description is too short to explain usage: %q", name, description)
		}
		schema, ok := definition["inputSchema"].(map[string]any)
		if !ok {
			t.Fatalf("%s has no input schema", name)
		}
		if schema["type"] != "object" {
			t.Errorf("%s input schema type = %v, want object", name, schema["type"])
		}
		if schema["additionalProperties"] != false {
			t.Errorf("%s input schema must reject unknown arguments", name)
		}
		for property, raw := range mcpProperties(t, schema, name) {
			propertySchema, ok := raw.(map[string]any)
			if !ok {
				t.Errorf("%s.%s schema is not an object", name, property)
				continue
			}
			if strings.TrimSpace(mcpText(propertySchema["description"])) == "" {
				t.Errorf("%s.%s has no description", name, property)
			}
		}
	}
	for _, name := range []string{
		"redux_document_state",
		"redux_chart_read",
		"redux_chart_validate",
		"redux_chart_apply",
		"redux_code_guide",
		"redux_code_run",
	} {
		if !seen[name] {
			t.Errorf("missing tool: %s", name)
		}
	}
}

func TestMCPCodeRunSchemaDocumentsTheCellContract(t *testing.T) {
	tool, ok := mcpToolByName["redux_code_run"]
	if !ok {
		t.Fatal("redux_code_run is not registered")
	}
	if tool.readOnly {
		t.Error("redux_code_run must allow chart transactions in this release")
	}
	required := mcpRequired(t, tool.inputSchema)
	if len(required) != 1 || required[0] != "source" {
		t.Fatalf("redux_code_run required = %v, want [source]", required)
	}
	properties := mcpProperties(t, tool.inputSchema, "redux_code_run")
	source := mcpText(properties["source"].(map[string]any)["description"])
	for _, phrase := range []string{"apply chart transactions", "redux_code_guide", "network", "DOM"} {
		if !strings.Contains(source, phrase) {
			t.Errorf("source description does not mention %q", phrase)
		}
	}
	timeout := properties["timeoutMs"].(map[string]any)
	if timeout["maximum"] != 20000 {
		t.Errorf("timeout maximum = %v, want 20000", timeout["maximum"])
	}
	expected := properties["expected"].(map[string]any)
	if expected["additionalProperties"] != false {
		t.Error("expected revision schema must reject unknown fields")
	}
	for _, field := range []string{"chartFingerprint", "diskSnapshot", "generation"} {
		if _, ok := expected["properties"].(map[string]any)[field]; !ok {
			t.Errorf("expected revision schema is missing %s", field)
		}
	}

	guide, ok := mcpToolByName["redux_code_guide"]
	if !ok {
		t.Fatal("redux_code_guide is not registered")
	}
	if !guide.readOnly {
		t.Error("redux_code_guide must be read-only")
	}
	if len(mcpRequired(t, guide.inputSchema)) != 0 {
		t.Error("redux_code_guide must not require arguments")
	}
}

func TestMCPChartReadSchemaDocumentsPaging(t *testing.T) {
	tool, ok := mcpToolByName["redux_chart_read"]
	if !ok {
		t.Fatal("redux_chart_read is not registered")
	}
	properties := mcpProperties(t, tool.inputSchema, "redux_chart_read")
	required := mcpRequired(t, tool.inputSchema)
	if len(required) != 1 || required[0] != "collection" {
		t.Fatalf("redux_chart_read required = %v, want [collection]", required)
	}
	collections := mcpList(properties["collection"].(map[string]any)["enum"])
	if strings.Join(collections, ",") != "metadata,lines,notes,events" {
		t.Fatalf("collection enum = %v", collections)
	}
	limit := properties["limit"].(map[string]any)
	if limit["maximum"] != 100 {
		t.Fatalf("limit schema does not cap the page size: %v", limit)
	}
}

func TestMCPChartApplySchemaDocumentsTheTransactionGrammar(t *testing.T) {
	tool, ok := mcpToolByName["redux_chart_apply"]
	if !ok {
		t.Fatal("redux_chart_apply is not registered")
	}
	required := mcpRequired(t, tool.inputSchema)
	if strings.Join(required, ",") != "request,expectedChartFingerprint" {
		t.Fatalf("redux_chart_apply required = %v", required)
	}
	properties := mcpProperties(t, tool.inputSchema, "redux_chart_apply")
	request := properties["request"].(map[string]any)
	if request["$ref"] != "#/$defs/chartTransaction" {
		t.Fatalf("apply request does not reference the transaction definition: %v", request)
	}
	definitions, ok := tool.inputSchema["$defs"].(map[string]any)
	if !ok {
		t.Fatal("apply input schema has no $defs")
	}
	for name, raw := range definitions {
		definition, ok := raw.(map[string]any)
		if !ok {
			t.Errorf("$defs.%s is not an object schema", name)
			continue
		}
		if strings.TrimSpace(mcpText(definition["description"])) == "" {
			t.Errorf("$defs.%s has no description", name)
		}
	}
	transaction, ok := definitions["chartTransaction"].(map[string]any)
	if !ok {
		t.Fatal("apply input schema has no chartTransaction definition")
	}
	transactionProperties := mcpProperties(t, transaction, "chartTransaction")
	for _, section := range []string{"label", "metadata", "timing", "lines", "notes", "events"} {
		if _, ok := transactionProperties[section]; !ok {
			t.Errorf("transaction schema is missing %s", section)
		}
	}
	timing := mcpProperties(t, transactionProperties["timing"].(map[string]any), "timing")
	if _, ok := timing["bpmList"]; !ok {
		t.Error("timing schema is missing bpmList")
	}
	bpmEntry, ok := definitions["bpmEntry"].(map[string]any)
	if !ok {
		t.Fatal("transaction schema has no bpmEntry definition")
	}
	bpmProperties := mcpProperties(t, bpmEntry, "bpmEntry")
	if _, ok := bpmProperties["bpm"]; !ok {
		t.Error("bpmEntry schema is missing bpm")
	}
	if _, ok := bpmProperties["startTime"]; !ok {
		t.Error("bpmEntry schema is missing startTime")
	}

	note, ok := definitions["note"].(map[string]any)
	if !ok {
		t.Fatal("transaction schema has no note definition")
	}
	noteRequired := mcpRequired(t, note)
	for _, field := range []string{"type", "startTime", "endTime", "positionX"} {
		if !mcpHas(noteRequired, field) {
			t.Errorf("note schema does not require %s", field)
		}
	}
	noteProperties := mcpProperties(t, note, "note")
	if !strings.Contains(mcpText(noteProperties["type"].(map[string]any)["description"]), "hold") {
		t.Error("note type schema does not explain the note kinds")
	}
	beat, ok := definitions["beat"].(map[string]any)
	if !ok {
		t.Fatal("transaction schema has no beat definition")
	}
	if beat["minItems"] != 3 || beat["maxItems"] != 3 {
		t.Errorf("beat schema does not pin the triple length: %v", beat)
	}
	if items, ok := beat["items"].(map[string]any); !ok || items["type"] != "integer" {
		t.Errorf("beat schema does not require integer components: %v", beat)
	}
	if !strings.Contains(mcpText(beat["description"]), "numerator") {
		t.Error("beat schema does not explain the triple")
	}

	eventInsert, ok := definitions["eventInsert"].(map[string]any)
	if !ok {
		t.Fatal("transaction schema has no eventInsert definition")
	}
	for _, definitionName := range []string{"noteInsert", "eventInsert"} {
		definition := definitions[definitionName].(map[string]any)
		if targets, ok := definition["anyOf"].([]any); !ok || len(targets) == 0 {
			t.Errorf("%s does not require a line target", definitionName)
		}
	}
	eventProperties := mcpProperties(t, eventInsert, "eventInsert")
	tracks := mcpList(eventProperties["eventType"].(map[string]any)["enum"])
	if len(tracks) != 12 {
		t.Fatalf("event track enum has %d entries, want 12: %v", len(tracks), tracks)
	}
	if !strings.Contains(mcpText(eventProperties["layer"].(map[string]any)["description"]), "extended") {
		t.Error("event layer schema does not explain extended tracks")
	}

	validate, ok := mcpToolByName["redux_chart_validate"]
	if !ok {
		t.Fatal("redux_chart_validate is not registered")
	}
	if _, ok := validate.inputSchema["$defs"].(map[string]any); !ok {
		t.Error("validate input schema does not carry the transaction grammar")
	}
	validateRequired := mcpRequired(t, validate.inputSchema)
	if len(validateRequired) != 1 || validateRequired[0] != "request" {
		t.Errorf("validate required = %v, want [request]", validateRequired)
	}
	if !strings.Contains(tool.description, "chartTransaction") {
		t.Error("apply description does not point at the transaction definition")
	}
	if !strings.Contains(tool.description, "expectedChartFingerprint") {
		t.Error("apply description does not name the required fingerprint")
	}
}

func TestMCPToolDefinitionsMarshalAsJSON(t *testing.T) {
	if _, err := json.Marshal(mcpToolDefinitions()); err != nil {
		t.Fatalf("tool definitions do not marshal: %v", err)
	}
}

func TestCellHTTPStatusMapping(t *testing.T) {
	cases := []struct {
		code string
		want int
	}{
		{"disabled", http.StatusForbidden},
		{"invalid_request", http.StatusBadRequest},
		{"stale_read", http.StatusConflict},
		{"busy", http.StatusConflict},
		{"cancelled", http.StatusConflict},
		{"timeout", http.StatusGatewayTimeout},
		{"runtime", http.StatusServiceUnavailable},
		{"unavailable", http.StatusServiceUnavailable},
		{"failed", http.StatusInternalServerError},
		{"unknown", http.StatusBadRequest},
	}
	for _, test := range cases {
		if status := cellHTTPStatus(test.code); status != test.want {
			t.Errorf("cellHTTPStatus(%q) = %d, want %d", test.code, status, test.want)
		}
	}
}

func TestCellHTTPErrorKeepsDetailsAndRevisions(t *testing.T) {
	recorder := httptest.NewRecorder()
	details := map[string]any{
		"logs":       []any{},
		"durationMs": float64(10_000),
	}
	revisions := map[string]any{
		"chartFingerprint": "fp",
		"diskSnapshot":     nil,
		"generation":       float64(2),
	}
	writeCellHTTPError(
		recorder,
		http.StatusGatewayTimeout,
		"timeout",
		"Code cell execution timed out",
		details,
		revisions,
	)
	if recorder.Code != http.StatusGatewayTimeout {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusGatewayTimeout)
	}
	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode cell error: %v: %s", err, recorder.Body.String())
	}
	if body["ok"] != false {
		t.Fatalf("ok = %#v, want false", body["ok"])
	}
	errorRecord, ok := body["error"].(map[string]any)
	if !ok {
		t.Fatalf("error is not an object: %#v", body["error"])
	}
	if errorRecord["code"] != "timeout" || errorRecord["message"] != "Code cell execution timed out" {
		t.Fatalf("error = %#v", errorRecord)
	}
	if errorRecord["details"] == nil {
		t.Fatal("cell error lost details")
	}
	if body["revisions"] == nil {
		t.Fatal("cell error lost revisions")
	}
}

func TestMCPToolResultKeepsStructuredErrors(t *testing.T) {
	response := map[string]any{
		"ok": false,
		"error": map[string]any{
			"code":    "ai.feature.restricted",
			"message": "The request is restricted by the user's AI access settings",
			"details": map[string]any{
				"issues": []any{
					map[string]any{
						"code":    "ai.feature.restricted",
						"message": "notes are disabled for AI",
						"path":    "notes.insert",
					},
				},
			},
		},
		"revisions": map[string]any{
			"chartFingerprint": "fp",
			"diskSnapshot":     nil,
			"generation":       float64(4),
		},
	}
	message := mcpToolResult("call-1", response)
	result, ok := message["result"].(map[string]any)
	if !ok {
		t.Fatalf("tool result is not an object: %#v", message)
	}
	if result["isError"] != true {
		t.Fatalf("isError = %#v, want true", result["isError"])
	}
	structured, ok := result["structuredContent"].(map[string]any)
	if !ok {
		t.Fatalf("structuredContent is not an object: %#v", result["structuredContent"])
	}
	errorRecord, ok := structured["error"].(map[string]any)
	if !ok {
		t.Fatalf("structured error is not an object: %#v", structured["error"])
	}
	if errorRecord["code"] != "ai.feature.restricted" {
		t.Fatalf("structured error code = %#v", errorRecord["code"])
	}
	details, ok := errorRecord["details"].(map[string]any)
	if !ok || details["issues"] == nil {
		t.Fatalf("structured error lost details: %#v", errorRecord)
	}
	if structured["code"] != "ai.feature.restricted" ||
		structured["message"] != response["error"].(map[string]any)["message"] {
		t.Fatalf("structured top-level error fields = %#v", structured)
	}
	if structured["details"] == nil {
		t.Fatal("structured top-level error lost details")
	}
	if structured["revisions"] == nil {
		t.Fatal("structured error lost the current revisions")
	}
	content, ok := result["content"].([]map[string]any)
	if !ok || len(content) < 2 {
		t.Fatalf("content = %#v, want readable text plus a JSON block", result["content"])
	}
	if content[0]["text"] != response["error"].(map[string]any)["message"] {
		t.Fatalf("first text block does not carry the readable message: %#v", content[0])
	}
	fallback, _ := content[1]["text"].(string)
	for _, wanted := range []string{"ai.feature.restricted", "notes.insert"} {
		if !strings.Contains(fallback, wanted) {
			t.Errorf("JSON text fallback does not contain %q: %s", wanted, fallback)
		}
	}
}

func TestMCPToolErrorCarriesStructuredUnavailableCode(t *testing.T) {
	message := mcpToolError("call-2", "no editor is connected")
	result := message["result"].(map[string]any)
	if result["isError"] != true {
		t.Fatalf("isError = %#v, want true", result["isError"])
	}
	structured := result["structuredContent"].(map[string]any)
	errorRecord := structured["error"].(map[string]any)
	if errorRecord["code"] != "unavailable" || errorRecord["message"] != "no editor is connected" {
		t.Fatalf("structured transport error = %#v", errorRecord)
	}
	if structured["code"] != "unavailable" || structured["message"] != "no editor is connected" {
		t.Fatalf("structured transport top-level fields = %#v", structured)
	}
}

func TestMCPBridgeRequiresSessionToken(t *testing.T) {
	token, err := mcpBridgeToken()
	if err != nil {
		t.Fatal(err)
	}
	if len(token) < 32 {
		t.Fatalf("bridge token is too short: %q", token)
	}
	server := &Server{}
	request := func(supplied string, bearer bool) *http.Request {
		r := httptest.NewRequest(http.MethodGet, BridgePath, nil)
		r.RemoteAddr = "127.0.0.1:53000"
		if supplied != "" && !bearer {
			query := r.URL.Query()
			query.Set("token", supplied)
			r.URL.RawQuery = query.Encode()
		}
		if supplied != "" && bearer {
			r.Header.Set("Authorization", "Bearer "+supplied)
		}
		return r
	}
	if server.bridgeTokenValid(request("", false)) {
		t.Error("a bridge without a token must be rejected")
	}
	if server.bridgeTokenValid(request("not-the-token", false)) {
		t.Error("a bridge with the wrong token must be rejected")
	}
	if !server.bridgeTokenValid(request(token, false)) {
		t.Error("the session token must authorize the bridge")
	}
	if !server.bridgeTokenValid(request(token, true)) {
		t.Error("the session token must also work as a bearer credential")
	}

	recorder := httptest.NewRecorder()
	server.handleBridge(recorder, request("", false))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated bridge status = %d, want 401", recorder.Code)
	}
}

func TestMCPEndpointFileCarriesTheBridgeToken(t *testing.T) {
	database := filepath.Join(t.TempDir(), "redux.db")
	path, err := EnsureEndpoint(database)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Dir(path) != filepath.Dir(database) || filepath.Base(path) != mcpEndpointFileName {
		t.Fatalf("endpoint path = %s", path)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var endpoint mcpEndpoint
	if err := json.Unmarshal(data, &endpoint); err != nil {
		t.Fatalf("decode endpoint file: %v: %s", err, data)
	}
	token, err := mcpBridgeToken()
	if err != nil {
		t.Fatal(err)
	}
	if endpoint.Version != mcpEndpointVersion || endpoint.Token != token || endpoint.Bridge != BridgePath {
		t.Fatalf("endpoint file = %#v", endpoint)
	}
}
