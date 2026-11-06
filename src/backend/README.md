# Local data service

The Go sidecar provides the desktop app with a loopback-first HTTP API backed by
SQLite. It owns the chart library, immutable revisions, content-addressed assets,
and durable preferences. The native Tauri host handles file import and export;
a normal save commits the chart and its changed asset blobs here. The service
entry point is `src/backend/cmd/redux-service/`; domain packages live under
`src/backend/internal/`, and the HTTP route table is
`src/backend/internal/httpapi/api.go`. The TypeScript client is
`src/core/global/library/client.ts`.

## Runtime

The service uses `net/http`, `database/sql`, and the pure-Go `modernc.org/sqlite`
driver. The HTTP listener defaults to `127.0.0.1:47821`; the AI/MCP bridge
defaults to `127.0.0.1:47822`. `--port`, `--ai-port`, `--host`, and
`--db` override the address and database path. SQLite runs in WAL mode with a
15-second busy timeout. The desktop host starts the sidecar, waits for its
single JSON `listening` event (`event`, `port`, `aiPort`, `db`, `version`, `collabPort`),
and reuses an already healthy service instead of starting a second one. Multiple
editor copies may share the process. `--dev` (or `REDUX_SERVER_DEV=1`) adds the
local Vite origins to the CORS allowlist; a packaged launch leaves them out.

Each frontend registers an instance id and sends a heartbeat. In-memory document
occupancy rejects a second editor opening the same file path or library project.
Instance leases and document locks expire after a missed 30-second heartbeat
window. The SQLite library itself serializes cross-process writes through WAL.

## HTTP surface

The API identity is `rpe-redux-server`, API version `1`. Requests and responses
use JSON, and failures use `{ "error": { "code", "message" } }`. The main route
groups are:

- `/api/health`, `/api/instances/*`, and `/api/occupancy/*` for service and
  editor leases.
- `/api/projects/*` for project summaries, chart commits, assets, duplication,
  and revisions.
- `/api/revisions/*` for revision reads and deletion.
- `/api/preferences` for the durable preference blob. `GET` is a normal read;
  `PUT` requires the per-process token from `preferences-endpoint.json` beside
  the database (`GET /api/preferences/endpoint` reports the path and header
  name), accepts only the known section catalog, and validates each section's
  JSON shape before replacing the document.
- `/api/maintenance/checkpoint` for a WAL checkpoint before native backup.

Request bodies are capped at 64 MiB; a single staged asset is capped at 256 MiB.
Clients use the TypeScript library client instead of constructing URLs.

## Collaboration

The same process hosts collaboration rooms on `ws://127.0.0.1:47830` by default
(`collab_*.go`). Rooms and content-addressed assets persist under `--collab-data`
or, by default, `<database directory>/collaboration`. Use `--collab-port 0` for
an ephemeral port, `--collab-host 0.0.0.0` to expose rooms on a LAN, or
`--no-collab` to disable the listener. A non-loopback host serves plaintext
`ws://`; terminate TLS at a reverse proxy outside the process. The developer-only
standalone Node server remains available for LAN and direct-TLS tests.

## MCP and code cells

`POST /api/mcp` is a loopback JSON-RPC endpoint for external MCP clients. It
accepts loopback peers with a JSON content type and rejects browser origins.
`/api/mcp/bridge` is the private WebSocket used by the desktop frontend. It
requires the per-process session token from `mcp-endpoint.json` beside the
database; `GET /api/mcp/endpoint` reports the file path without exposing the
token. The sidecar forwards requests to the mounted editor, which owns chart
state and commits. Tool failures keep the adapter's `code` and `details` in
`structuredContent` and in a JSON fallback text block.

`GET /api/cell/guide` and `POST /api/cell/run` run on a stricter boundary: the
listener and peer must both be loopback, and browser origins are rejected. Code
cells are read-only; the HTTP surface has no apply route. Enabling code
execution in Settings is a separate consent from enabling MCP.

## Build and run

```sh
go run ./cmd/redux-service   # from src/backend
npm run build:server         # compiles the target-specific sidecar for packaging
npm run build                # full desktop build, including the sidecar
```

The build writes `src-tauri/resources/redux-service` (and the Windows `.exe`
copy) from `src/backend/build.ts`, which targets `./cmd/redux-service` and keeps
the linker-injected `main.version` contract.
