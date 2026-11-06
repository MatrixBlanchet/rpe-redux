// Object-addressed chart change application for the embedded collaboration
// server. It mirrors src/core/collaboration/changes.ts closely enough that a
// desktop room and a standalone room accept the same transactions.

package collab

import (
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"
)

// collabChange is one field-level set/add/remove against an accepted chart.
type collabChange struct {
	Op       string `json:"op"`
	Path     string `json:"path"`
	Before   any    `json:"before,omitempty"`
	After    any    `json:"after,omitempty"`
	Position *int   `json:"position,omitempty"`
}

// collabTokenKind distinguishes an object key, an array index, and an
// id-addressed array element.
type collabTokenKind int

// Token kinds produced by collabParsePath.
const (
	collabKey collabTokenKind = iota
	collabIndex
	collabID
)

// collabToken is one parsed path segment.
type collabToken struct {
	kind  collabTokenKind
	key   string
	index int
	id    string
}

// jsonUndefined distinguishes an absent path from a JSON null value.
type jsonUndefined struct{}

// absent stands for a path that does not exist.
var absent = jsonUndefined{}

// collabIndexPattern matches a canonical non-negative array index.
var collabIndexPattern = regexp.MustCompile(`^(0|[1-9][0-9]*)$`)

func collabIsRecord(value any) (map[string]any, bool) {
	record, ok := value.(map[string]any)
	return record, ok
}

func collabHasOwn(record map[string]any, key string) bool {
	_, ok := record[key]
	return ok
}

// collabUnescape decodes "~1" before "~0" so a nested escape survives.
func collabUnescape(value string) string {
	value = strings.ReplaceAll(value, "~1", "/")
	return strings.ReplaceAll(value, "~0", "~")
}

// collabParsePath splits a JSON Pointer into key, index, and id-addressed
// tokens. A "$" prefix marks an id-addressed array element.
func collabParsePath(path string) ([]collabToken, error) {
	if path == "" {
		return nil, nil
	}
	if !strings.HasPrefix(path, "/") {
		return nil, fmt.Errorf("invalid change path: %s", path)
	}
	raw := strings.Split(path[1:], "/")
	tokens := make([]collabToken, 0, len(raw))
	for _, part := range raw {
		token := collabUnescape(part)
		if strings.HasPrefix(token, "$") && len(token) > 1 {
			tokens = append(tokens, collabToken{kind: collabID, id: token[1:]})
			continue
		}
		if collabIndexPattern.MatchString(token) {
			index, err := strconv.Atoi(token)
			if err != nil {
				return nil, err
			}
			tokens = append(tokens, collabToken{kind: collabIndex, index: index})
			continue
		}
		tokens = append(tokens, collabToken{kind: collabKey, key: token})
	}
	return tokens, nil
}

// collabQuoteString encodes a JSON string; canonical output avoids relying on
// encoding/json map ordering.
func collabQuoteString(value string) string {
	var builder strings.Builder
	builder.WriteByte('"')
	for _, character := range value {
		switch character {
		case '"':
			builder.WriteString(`\"`)
		case '\\':
			builder.WriteString(`\\`)
		case '\b':
			builder.WriteString(`\b`)
		case '\f':
			builder.WriteString(`\f`)
		case '\n':
			builder.WriteString(`\n`)
		case '\r':
			builder.WriteString(`\r`)
		case '\t':
			builder.WriteString(`\t`)
		default:
			if character < 0x20 {
				fmt.Fprintf(&builder, `\u%04x`, character)
			} else {
				builder.WriteRune(character)
			}
		}
	}
	builder.WriteByte('"')
	return builder.String()
}

// collabCanonicalNumber renders a float with the shortest round-trip digits
// and the same decimal/exponent thresholds as ECMAScript Number#toString, then
// removes a positive exponent's '+'. Zero, including negative zero, is "0";
// NaN and infinities, which JSON cannot carry, are "null".
func collabCanonicalNumber(value float64) string {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return "null"
	}
	if value == 0 {
		return "0"
	}
	negative := math.Signbit(value)
	if negative {
		value = -value
	}
	formatted := strconv.FormatFloat(value, 'e', -1, 64)
	mantissa, exponentText, ok := strings.Cut(formatted, "e")
	if !ok {
		return formatted
	}
	exponent, err := strconv.Atoi(exponentText)
	if err != nil {
		return formatted
	}
	digits := strings.ReplaceAll(mantissa, ".", "")
	digits = strings.TrimRight(digits, "0")
	if digits == "" {
		digits = "0"
	}
	// n is the decimal point's position relative to the digit string, matching
	// the ECMAScript Number::toString algorithm.
	n := exponent + 1
	var builder strings.Builder
	if negative {
		builder.WriteByte('-')
	}
	switch {
	case n >= len(digits) && n <= 21:
		builder.WriteString(digits)
		builder.WriteString(strings.Repeat("0", n-len(digits)))
	case n > 0 && n <= 21:
		builder.WriteString(digits[:n])
		builder.WriteByte('.')
		builder.WriteString(digits[n:])
	case n > -6 && n <= 0:
		builder.WriteString("0.")
		builder.WriteString(strings.Repeat("0", -n))
		builder.WriteString(digits)
	default:
		builder.WriteString(digits[:1])
		if len(digits) > 1 {
			builder.WriteByte('.')
			builder.WriteString(digits[1:])
		}
		builder.WriteByte('e')
		builder.WriteString(strconv.Itoa(n - 1))
	}
	return builder.String()
}

// collabCanonical renders a decoded JSON value with sorted keys so equal
// values produce identical text.
func collabCanonical(value any) string {
	switch typed := value.(type) {
	case nil:
		return "null"
	case bool:
		if typed {
			return "true"
		}
		return "false"
	case float64:
		return collabCanonicalNumber(typed)
	case string:
		return collabQuoteString(typed)
	case []any:
		parts := make([]string, len(typed))
		for index, item := range typed {
			parts[index] = collabCanonical(item)
		}
		return "[" + strings.Join(parts, ",") + "]"
	case map[string]any:
		keys := make([]string, 0, len(typed))
		for key := range typed {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		parts := make([]string, 0, len(keys))
		for _, key := range keys {
			parts = append(parts, collabQuoteString(key)+":"+collabCanonical(typed[key]))
		}
		return "{" + strings.Join(parts, ",") + "}"
	default:
		encoded, err := json.Marshal(value)
		if err != nil {
			return "null"
		}
		return string(encoded)
	}
}

// collabFingerprint is the same FNV-1a digest over canonical JSON that the
// TypeScript room uses. Iterating UTF-16 code units keeps non-ASCII chart names
// identical across the two implementations.
func collabFingerprint(value any) string {
	hash := uint32(0x811c9dc5)
	for _, unit := range utf16.Encode([]rune(collabCanonical(value))) {
		hash ^= uint32(unit)
		hash *= 0x01000193
	}
	return fmt.Sprintf("%08x", hash)
}

// collabDeepEqual compares decoded JSON values, treating absent as a distinct
// sentinel.
func collabDeepEqual(left, right any) bool {
	if _, ok := left.(jsonUndefined); ok {
		_, rightAbsent := right.(jsonUndefined)
		return rightAbsent
	}
	if _, ok := right.(jsonUndefined); ok {
		return false
	}
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	switch leftValue := left.(type) {
	case []any:
		rightValue, ok := right.([]any)
		if !ok || len(leftValue) != len(rightValue) {
			return false
		}
		for index := range leftValue {
			if !collabDeepEqual(leftValue[index], rightValue[index]) {
				return false
			}
		}
		return true
	case map[string]any:
		rightValue, ok := right.(map[string]any)
		if !ok || len(leftValue) != len(rightValue) {
			return false
		}
		for key, value := range leftValue {
			other, present := rightValue[key]
			if !present || !collabDeepEqual(value, other) {
				return false
			}
		}
		return true
	default:
		return reflect.DeepEqual(left, right)
	}
}

// collabClone deep-copies the containers of a decoded JSON value.
func collabClone(value any) any {
	switch typed := value.(type) {
	case []any:
		next := make([]any, len(typed))
		for index, item := range typed {
			next[index] = collabClone(item)
		}
		return next
	case map[string]any:
		next := make(map[string]any, len(typed))
		for key, item := range typed {
			next[key] = collabClone(item)
		}
		return next
	default:
		return value
	}
}

// collabResolveParent walks all but the last token and returns the containing
// value plus the final token.
func collabResolveParent(root any, tokens []collabToken) (any, collabToken, bool) {
	if len(tokens) == 0 {
		return nil, collabToken{}, false
	}
	current := root
	for _, token := range tokens[:len(tokens)-1] {
		switch token.kind {
		case collabKey:
			record, ok := current.(map[string]any)
			if !ok || !collabHasOwn(record, token.key) {
				return nil, collabToken{}, false
			}
			current = record[token.key]
		case collabIndex:
			list, ok := current.([]any)
			if !ok || token.index >= len(list) {
				return nil, collabToken{}, false
			}
			current = list[token.index]
		case collabID:
			list, ok := current.([]any)
			if !ok {
				return nil, collabToken{}, false
			}
			found := false
			for _, item := range list {
				record, ok := item.(map[string]any)
				if ok && collabString(record["id"]) == token.id {
					current = item
					found = true
					break
				}
			}
			if !found {
				return nil, collabToken{}, false
			}
		}
	}
	return current, tokens[len(tokens)-1], true
}

func collabString(value any) string {
	text, _ := value.(string)
	return text
}

// collabReadAt reads the node addressed by token, returning absent when it does
// not exist.
func collabReadAt(parent any, token collabToken) any {
	switch token.kind {
	case collabKey:
		record, ok := parent.(map[string]any)
		if !ok || !collabHasOwn(record, token.key) {
			return absent
		}
		return record[token.key]
	case collabIndex:
		list, ok := parent.([]any)
		if !ok || token.index >= len(list) {
			return absent
		}
		return list[token.index]
	case collabID:
		list, ok := parent.([]any)
		if !ok {
			return absent
		}
		for _, item := range list {
			record, ok := item.(map[string]any)
			if ok && collabString(record["id"]) == token.id {
				return item
			}
		}
		return absent
	}
	return absent
}

// collabUnsafeKeys are object keys a change may never create or remove.
var collabUnsafeKeys = map[string]struct{}{
	"__proto__":   {},
	"constructor": {},
	"prototype":   {},
}

// collabSetAtPath replaces the node addressed by tokens, rebuilding every
// containing slice header so an insert or delete propagates to the chart.
func collabSetAtPath(root any, tokens []collabToken, value any) (any, bool) {
	if len(tokens) == 0 {
		return value, true
	}
	token := tokens[0]
	rest := tokens[1:]
	switch token.kind {
	case collabKey:
		record, ok := root.(map[string]any)
		if !ok || !collabHasOwn(record, token.key) {
			return root, false
		}
		child, ok := collabSetAtPath(record[token.key], rest, value)
		if !ok {
			return root, false
		}
		record[token.key] = child
		return record, true
	case collabIndex:
		list, ok := root.([]any)
		if !ok || token.index >= len(list) {
			return root, false
		}
		child, ok := collabSetAtPath(list[token.index], rest, value)
		if !ok {
			return root, false
		}
		list[token.index] = child
		return list, true
	case collabID:
		list, ok := root.([]any)
		if !ok {
			return root, false
		}
		for index, item := range list {
			record, ok := item.(map[string]any)
			if ok && collabString(record["id"]) == token.id {
				child, ok := collabSetAtPath(item, rest, value)
				if !ok {
					return root, false
				}
				list[index] = child
				return list, true
			}
		}
		return root, false
	}
	return root, false
}

// collabWriteAt inserts or replaces a value at token, rebuilding slices so an
// insert propagates to the caller.
func collabWriteAt(parent any, token collabToken, value any, position *int, replace bool) (any, bool) {
	switch token.kind {
	case collabKey:
		record, ok := parent.(map[string]any)
		if !ok {
			return parent, false
		}
		if _, unsafe := collabUnsafeKeys[token.key]; unsafe {
			return parent, false
		}
		record[token.key] = value
		return record, true
	case collabIndex:
		list, ok := parent.([]any)
		if !ok || token.index > len(list) {
			return parent, false
		}
		if replace && token.index < len(list) {
			list[token.index] = value
			return list, true
		}
		next := make([]any, len(list)+1)
		copy(next, list[:token.index])
		next[token.index] = value
		copy(next[token.index+1:], list[token.index:])
		return next, true
	case collabID:
		list, ok := parent.([]any)
		if !ok {
			return parent, false
		}
		for index, item := range list {
			record, ok := item.(map[string]any)
			if ok && collabString(record["id"]) == token.id {
				if !replace {
					return parent, false
				}
				list[index] = value
				return list, true
			}
		}
		index := len(list)
		if position != nil {
			index = *position
			if index < 0 {
				index = 0
			}
			if index > len(list) {
				index = len(list)
			}
		}
		next := make([]any, len(list)+1)
		copy(next, list[:index])
		next[index] = value
		copy(next[index+1:], list[index:])
		return next, true
	}
	return parent, false
}

// collabDeleteAt removes the node addressed by token, rebuilding slices.
func collabDeleteAt(parent any, token collabToken) (any, bool) {
	switch token.kind {
	case collabKey:
		record, ok := parent.(map[string]any)
		if !ok || !collabHasOwn(record, token.key) {
			return parent, false
		}
		if _, unsafe := collabUnsafeKeys[token.key]; unsafe {
			return parent, false
		}
		delete(record, token.key)
		return record, true
	case collabIndex:
		list, ok := parent.([]any)
		if !ok || token.index >= len(list) {
			return parent, false
		}
		next := make([]any, 0, len(list)-1)
		next = append(next, list[:token.index]...)
		next = append(next, list[token.index+1:]...)
		return next, true
	case collabID:
		list, ok := parent.([]any)
		if !ok {
			return parent, false
		}
		for index, item := range list {
			record, ok := item.(map[string]any)
			if ok && collabString(record["id"]) == token.id {
				next := make([]any, 0, len(list)-1)
				next = append(next, list[:index]...)
				next = append(next, list[index+1:]...)
				return next, true
			}
		}
		return parent, false
	}
	return parent, false
}

// collabPathDepth counts the segments of a change path, returning zero for an
// unparsable path.
func collabPathDepth(path string) int {
	tokens, err := collabParsePath(path)
	if err != nil {
		return 0
	}
	return len(tokens)
}

// collabApplyChanges applies a batch atomically. Any stale base or malformed
// path rejects the batch and returns the original chart.
func collabApplyChanges(chart any, changes []collabChange) (any, []string) {
	next := collabClone(chart)
	conflicts := make([]string, 0)
	ordered := append([]collabChange(nil), changes...)
	sort.SliceStable(ordered, func(left, right int) bool {
		return collabPathDepth(ordered[left].Path) < collabPathDepth(ordered[right].Path)
	})
	replaced := make([]string, 0)
	for _, change := range ordered {
		skipped := false
		for _, parent := range replaced {
			if strings.HasPrefix(change.Path, parent+"/") {
				skipped = true
				break
			}
		}
		if skipped {
			continue
		}
		tokens, err := collabParsePath(change.Path)
		if err != nil {
			conflicts = append(conflicts, change.Path)
			continue
		}
		if len(tokens) == 0 {
			if change.Op != "set" || !collabDeepEqual(next, change.Before) {
				conflicts = append(conflicts, change.Path)
				continue
			}
			next = collabClone(change.After)
			replaced = append(replaced, change.Path)
			continue
		}
		parent, token, ok := collabResolveParent(next, tokens)
		if !ok {
			conflicts = append(conflicts, change.Path)
			continue
		}
		current := collabReadAt(parent, token)
		switch change.Op {
		case "set":
			if !collabDeepEqual(current, change.Before) {
				conflicts = append(conflicts, change.Path)
				continue
			}
			nextParent, written := collabWriteAt(parent, token, change.After, change.Position, true)
			if !written {
				conflicts = append(conflicts, change.Path)
				continue
			}
			updated, ok := collabSetAtPath(next, tokens[:len(tokens)-1], nextParent)
			if !ok {
				conflicts = append(conflicts, change.Path)
				continue
			}
			next = updated
			replaced = append(replaced, change.Path)
		case "add":
			if _, present := current.(jsonUndefined); !present {
				conflicts = append(conflicts, change.Path)
				continue
			}
			nextParent, written := collabWriteAt(parent, token, change.After, change.Position, false)
			if !written {
				conflicts = append(conflicts, change.Path)
				continue
			}
			updated, ok := collabSetAtPath(next, tokens[:len(tokens)-1], nextParent)
			if !ok {
				conflicts = append(conflicts, change.Path)
				continue
			}
			next = updated
		case "remove":
			if !collabDeepEqual(current, change.Before) {
				conflicts = append(conflicts, change.Path)
				continue
			}
			nextParent, deleted := collabDeleteAt(parent, token)
			if !deleted {
				conflicts = append(conflicts, change.Path)
				continue
			}
			updated, ok := collabSetAtPath(next, tokens[:len(tokens)-1], nextParent)
			if !ok {
				conflicts = append(conflicts, change.Path)
				continue
			}
			next = updated
		default:
			conflicts = append(conflicts, change.Path)
		}
	}
	if len(conflicts) > 0 {
		return chart, conflicts
	}
	return next, nil
}

// collabLockKeys is the chart, line, and object scope set a change batch needs.
type collabLockKeys struct {
	chart   bool
	lines   []string
	objects []string
}

// collabStringSet merges groups into one de-duplicated slice preserving order.
func collabStringSet(values ...[]string) []string {
	seen := make(map[string]struct{})
	result := make([]string, 0)
	for _, group := range values {
		for _, value := range group {
			if _, exists := seen[value]; exists {
				continue
			}
			seen[value] = struct{}{}
			result = append(result, value)
		}
	}
	return result
}

// collabChangeLockKeys derives the chart/line/object scopes a transaction
// needs, matching the cooperative locks the client acquires.
func collabChangeLockKeys(changes []collabChange) collabLockKeys {
	keys := collabLockKeys{}
	lines := make([]string, 0)
	objects := make([]string, 0)
	for _, change := range changes {
		tokens, err := collabParsePath(change.Path)
		if err != nil || len(tokens) == 0 || tokens[0].kind != collabKey || tokens[0].key != "judgeLineList" {
			keys.chart = true
			continue
		}
		if len(tokens) < 2 || tokens[1].kind != collabID {
			keys.chart = true
			continue
		}
		lineKey := "line:" + tokens[1].id
		lines = append(lines, lineKey)
		isObjectChange := len(tokens) > 3 &&
			tokens[2].kind == collabKey &&
			(tokens[2].key == "notes" || tokens[2].key == "eventLayers")
		if isObjectChange {
			if tokens[3].kind == collabID {
				objects = append(objects, "obj:"+tokens[3].id)
			}
		} else if change.Op != "set" {
			// Adding or removing a line shifts parent indices.
			keys.chart = true
		}
	}
	keys.lines = collabStringSet(lines)
	keys.objects = collabStringSet(objects)
	return keys
}
