// Content-addressed room assets: names, MIME labels, size limits, and the
// cheap magic-byte check that keeps a mislabeled script out of image decoders.

package collab

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"strings"
	"unicode/utf8"
)

// collabAssetChunkBytes is the chunk size used for asset transfers.
const collabAssetChunkBytes = 256 << 10

// sha256Hex is the stable content id shared with the library asset store.
func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// collabMaxAssetNameRunes bounds a resource name by Unicode code points so a
// name that fits here has the same length on both room implementations.
const collabMaxAssetNameRunes = 240

// Validation patterns for member colors, content hashes, and absolute Windows
// paths.
var (
	collabColorPattern     = regexp.MustCompile(`^#[0-9a-f]{6}$`)
	collabAssetHashPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)
	collabDrivePattern     = regexp.MustCompile(`^[a-zA-Z]:/`)
)

// collabAllowedMime is the MIME allowlist for room assets.
var collabAllowedMime = map[string]bool{
	"image/png":                true,
	"image/jpeg":               true,
	"image/webp":               true,
	"image/gif":                true,
	"image/bmp":                true,
	"image/avif":               true,
	"audio/mpeg":               true,
	"audio/ogg":                true,
	"audio/wav":                true,
	"audio/flac":               true,
	"audio/mp4":                true,
	"audio/aac":                true,
	"audio/opus":               true,
	"audio/webm":               true,
	"application/octet-stream": true,
}

// collabSanitizeAssetName normalizes separators and rejects names that could
// escape the room asset directory.
func collabSanitizeAssetName(value string) string {
	name := strings.TrimSpace(strings.ReplaceAll(value, `\`, "/"))
	if name == "" || utf8.RuneCountInString(name) > collabMaxAssetNameRunes {
		return ""
	}
	if strings.HasPrefix(name, "/") || collabDrivePattern.MatchString(name) {
		return ""
	}
	for _, part := range strings.Split(name, "/") {
		if part == "" || part == ".." {
			return ""
		}
	}
	for _, character := range name {
		if character < 0x20 {
			return ""
		}
	}
	return name
}

func collabStartsWith(data []byte, value ...byte) bool {
	return bytes.HasPrefix(data, value)
}

// collabASCIIAt compares an ASCII literal at offset, tolerating short input.
func collabASCIIAt(data []byte, offset int, value string) bool {
	if offset < 0 || offset+len(value) > len(data) {
		return false
	}
	return string(data[offset:offset+len(value)]) == value
}

// collabMatchesAssetMagic verifies the leading bytes for the declared type.
// Unknown types are accepted only as application/octet-stream.
func collabMatchesAssetMagic(mime string, bytes []byte) bool {
	switch mime {
	case "image/png":
		return collabStartsWith(bytes, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
	case "image/jpeg":
		return collabStartsWith(bytes, 0xff, 0xd8, 0xff)
	case "image/gif":
		return collabASCIIAt(bytes, 0, "GIF8")
	case "image/webp":
		return collabASCIIAt(bytes, 0, "RIFF") && collabASCIIAt(bytes, 8, "WEBP")
	case "image/bmp":
		return collabASCIIAt(bytes, 0, "BM")
	case "image/avif":
		return collabASCIIAt(bytes, 4, "ftyp") &&
			(collabASCIIAt(bytes, 8, "avif") || collabASCIIAt(bytes, 8, "avis"))
	case "audio/mpeg":
		return collabASCIIAt(bytes, 0, "ID3") ||
			collabStartsWith(bytes, 0xff, 0xfb) ||
			collabStartsWith(bytes, 0xff, 0xf3) ||
			collabStartsWith(bytes, 0xff, 0xf2)
	case "audio/ogg":
		return collabASCIIAt(bytes, 0, "OggS")
	case "audio/wav":
		return collabASCIIAt(bytes, 0, "RIFF") && collabASCIIAt(bytes, 8, "WAVE")
	case "audio/flac":
		return collabASCIIAt(bytes, 0, "fLaC")
	case "audio/mp4":
		return collabASCIIAt(bytes, 4, "ftyp")
	case "audio/opus":
		return collabASCIIAt(bytes, 0, "OggS")
	case "audio/webm":
		return collabStartsWith(bytes, 0x1a, 0x45, 0xdf, 0xa3)
	default:
		return mime == "application/octet-stream"
	}
}
