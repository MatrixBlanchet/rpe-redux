// Wire guard for the opaque AES-GCM envelopes used by encrypted rooms. The
// server never imports a key or decrypts the payload.

package collab

import "strings"

// collabE2EAlgorithm is the only envelope algorithm the server accepts.
const collabE2EAlgorithm = "AES-GCM"

// collabIsEncryptedPayload validates the shape of an opaque AES-GCM envelope
// without reading its contents.
func collabIsEncryptedPayload(value any) bool {
	record, ok := value.(map[string]any)
	if !ok {
		return false
	}
	version, ok := record["v"].(float64)
	if !ok || version != 1 {
		return false
	}
	if alg, ok := record["alg"].(string); !ok || alg != collabE2EAlgorithm {
		return false
	}
	iv, ok := record["iv"].(string)
	if !ok || iv == "" || strings.ContainsAny(iv, "+/=") {
		return false
	}
	data, ok := record["data"].(string)
	return ok && data != "" && !strings.ContainsAny(data, "+/=")
}
