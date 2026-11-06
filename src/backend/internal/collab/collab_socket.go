// Room-specific attachment state layered on the shared websocket codec.

package collab

import "rperedux/server/internal/ws"

// collabSocket adds the room rate-limit identity and failed-join counter to a
// framed connection. Only the reader goroutine touches joinFailures.
type collabSocket struct {
	*ws.Conn
	joinFailures int
	clientKey    string
}
