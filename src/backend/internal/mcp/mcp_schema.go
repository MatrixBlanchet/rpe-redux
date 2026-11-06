// Client-facing JSON Schemas for the MCP chart tools.
//
// The mounted editor stays the authority that validates a transaction; these
// schemas only describe the request grammar so an external MCP client can build
// a valid transaction without reading the repository. Keep them in sync with
// src/core/edit/transaction/contract.ts and src/core/edit/mcp/adapter.ts.

package mcp

// mcpSchemaObject builds a closed object schema node: only the listed
// properties are accepted. Required property names are omitted when the node
// accepts any subset.
func mcpSchemaObject(properties map[string]any, required ...string) map[string]any {
	schema := map[string]any{
		"type":                 "object",
		"properties":           properties,
		"additionalProperties": false,
	}
	if len(required) > 0 {
		schema["required"] = required
	}
	return schema
}

// mcpSchemaPatchObject builds an open object node. Patches keep the chart
// forward-compatible, so unknown keys are forwarded verbatim.
func mcpSchemaPatchObject(properties map[string]any) map[string]any {
	return map[string]any{
		"type":                 "object",
		"properties":           properties,
		"additionalProperties": true,
	}
}

func mcpSchemaString(description string) map[string]any {
	return map[string]any{"type": "string", "description": description}
}

func mcpSchemaInteger(description string) map[string]any {
	return map[string]any{"type": "integer", "description": description}
}

func mcpSchemaNumber(description string) map[string]any {
	return map[string]any{"type": "number", "description": description}
}

// mcpSchemaBeat describes the chart's exact beat representation: a reduced
// rational triple instead of a float.
func mcpSchemaBeat(description string) map[string]any {
	return map[string]any{
		"type": "array",
		"description": description + " A beat is the reduced rational triple " +
			"[whole, numerator, denominator], for example [3, 1, 2] is 3.5; the " +
			"denominator is positive and the fraction is reduced.",
		"items":    map[string]any{"type": "integer"},
		"minItems": 3,
		"maxItems": 3,
	}
}

// mcpSchemaEventValue describes the polymorphic event endpoint: a number on the
// geometric tracks, an RGB triple on colorEvents, a %P% templated string on
// textEvents, and opaque JSON on paintEvents.
func mcpSchemaEventValue(description string) map[string]any {
	return map[string]any{
		"description": description,
		"anyOf": []any{
			map[string]any{"type": "number"},
			map[string]any{
				"type":     "array",
				"items":    map[string]any{"type": "number"},
				"minItems": 3,
				"maxItems": 3,
			},
			map[string]any{"type": "string"},
			map[string]any{"type": "object", "additionalProperties": true},
			map[string]any{"type": "null"},
		},
	}
}

// mcpEventTrackNames lists every event track the editor stores on a line.
func mcpEventTrackNames() []string {
	return []string{
		"moveXEvents",
		"moveYEvents",
		"rotateEvents",
		"alphaEvents",
		"speedEvents",
		"scaleXEvents",
		"scaleYEvents",
		"colorEvents",
		"paintEvents",
		"textEvents",
		"inclineEvents",
		"gifEvents",
	}
}

// mcpSchemaBeatRef references the shared beat definition.
func mcpSchemaBeatRef() map[string]any {
	return map[string]any{"$ref": "#/$defs/beat"}
}

// mcpSchemaObjectIdRef references the shared chart object id definition.
func mcpSchemaObjectIdRef() map[string]any {
	return map[string]any{"$ref": "#/$defs/chartObjectId"}
}

// mcpSchemaWithout copies a schema node without one property. Update patches
// reuse the insert shape but must not expose immutable identity fields.
func mcpSchemaWithout(source map[string]any, key string) map[string]any {
	clone := make(map[string]any, len(source))
	for name, value := range source {
		if name != key {
			clone[name] = value
		}
	}
	return clone
}

// mcpSchemaLineTarget requires inserts to name their owning judge line. The
// editor resolves lineId and lineIndex independently and rejects a mismatch.
func mcpSchemaLineTarget(schema map[string]any) map[string]any {
	schema["anyOf"] = []any{
		map[string]any{"required": []string{"lineId"}},
		map[string]any{"required": []string{"lineIndex"}},
	}
	return schema
}

// mcpChartTransactionDefinitions returns every reusable node of the transaction
// grammar except the transaction root itself.
//
// The transaction is ID-addressed: existing notes and events are updated or
// deleted by their object id, while inserts identify their owning line by id or
// zero-based index.
func mcpChartTransactionDefinitions() map[string]any {
	controlPoint := mcpSchemaObject(map[string]any{
		"x":      mcpSchemaNumber("Sample position: distance from the event start for alpha/pos/size/skew, or signed note distance from the judge line in chart units for yControl."),
		"alpha":  mcpSchemaNumber("Alpha value at this point."),
		"pos":    mcpSchemaNumber("Horizontal position factor at this point."),
		"size":   mcpSchemaNumber("Size factor at this point."),
		"skew":   mcpSchemaNumber("Skew value at this point."),
		"y":      mcpSchemaNumber("Vertical factor at this point."),
		"easing": mcpSchemaInteger("Easing id from this point to the next one."),
	})
	controlPoint["description"] = "One control-curve point; the named value applies at x. yControl samples by note distance from the line instead of event time."
	controlTrack := func(description string) map[string]any {
		return map[string]any{
			"type":        "array",
			"description": description,
			"items":       map[string]any{"$ref": "#/$defs/controlPoint"},
		}
	}
	noteValue := map[string]any{
		"id": mcpSchemaString("Optional client-supplied UUID-shaped id; omitted ids are assigned by the editor."),
		"type": map[string]any{
			"type":        "integer",
			"enum":        []int{1, 2, 3, 4},
			"description": "1 tap, 2 hold, 3 flick, 4 drag.",
		},
		"startTime": mcpSchemaBeatRef(),
		"endTime": map[string]any{
			"$ref":        "#/$defs/beat",
			"description": "End beat; hold notes (type 2) span startTime..endTime and the other note types keep it equal to startTime.",
		},
		"positionX": mcpSchemaNumber("Horizontal position in chart units: -675 left edge, 675 right edge, 0 centre."),
		"above": map[string]any{
			"type":        []string{"integer", "string", "null"},
			"description": "1 above the judgement line, 0 or 2 below; holds use 1 (above) or 0 (below).",
		},
		"isFake":      mcpSchemaInteger("1 keeps the note unjudged."),
		"speed":       mcpSchemaNumber("Note speed factor."),
		"size":        mcpSchemaNumber("Note size factor."),
		"yOffset":     mcpSchemaNumber("Vertical offset of an active hold head."),
		"visibleTime": mcpSchemaNumber("Seconds the note stays visible."),
		"alpha":       mcpSchemaNumber("0-255 note opacity."),
		"color": map[string]any{
			"type":        "array",
			"items":       map[string]any{"type": "number"},
			"minItems":    3,
			"maxItems":    3,
			"description": "RGB blend triple.",
		},
	}
	eventValue := map[string]any{
		"id":        mcpSchemaString("Optional client-supplied UUID-shaped id; omitted ids are assigned by the editor."),
		"startTime": map[string]any{"$ref": "#/$defs/beat", "description": "Event start beat."},
		"endTime":   map[string]any{"$ref": "#/$defs/beat", "description": "Event end beat."},
		"start": mcpSchemaEventValue(
			"Value at startTime. For moveYEvents this is the event layer's absolute line-center Y in chart units (positive is up), not a delta; values across event layers are summed.",
		),
		"end": mcpSchemaEventValue(
			"Value at endTime. For moveYEvents this value is held until the next event starts and the final event's end value persists; before the first event a layer contributes 0.",
		),
		"easingType":  mcpSchemaInteger("RPE easing id; 1 is linear."),
		"easingLeft":  mcpSchemaNumber("Easing range start in 0-1."),
		"easingRight": mcpSchemaNumber("Easing range end in 0-1."),
		"bezier":      map[string]any{"type": []string{"boolean", "number"}, "description": "Use bezierPoints instead of easingType."},
		"bezierPoints": map[string]any{
			"type":        "array",
			"items":       map[string]any{"type": "number"},
			"minItems":    4,
			"maxItems":    4,
			"description": "Bezier control points.",
		},
		"linkgroup": map[string]any{
			"type":        "integer",
			"description": "Link group id; linked events move together.",
		},
		"trajectory": map[string]any{
			"type":                 "object",
			"description":          "Whole-trajectory move payload; only valid on moveXEvents.",
			"additionalProperties": true,
		},
		"font": mcpSchemaString("textEvents font resource."),
	}
	chartMetadata := mcpSchemaPatchObject(map[string]any{
		"name":         mcpSchemaString("Chart title."),
		"composer":     mcpSchemaString("Composer."),
		"charter":      mcpSchemaString("Chart author."),
		"level":        mcpSchemaString("Difficulty label."),
		"song":         mcpSchemaString("Song resource name."),
		"background":   mcpSchemaString("Background resource name."),
		"illustration": mcpSchemaString("Illustration resource name."),
		"offset":       mcpSchemaNumber("Audio offset in milliseconds."),
		"RPEVersion":   mcpSchemaInteger("RPE format version."),
		"ReduxVersion": mcpSchemaString("Redux application version."),
	})
	chartMetadata["description"] = "Partial chart metadata; omitted fields keep their value and unknown format fields are preserved."
	bpmEntry := mcpSchemaObject(map[string]any{
		"bpm": mcpSchemaNumber("Tempo in beats per minute; greater than zero."),
		"startTime": map[string]any{
			"$ref":        "#/$defs/beat",
			"description": "Beat where this tempo begins.",
		},
	}, "bpm", "startTime")
	bpmEntry["description"] = "One tempo point. Entries are sorted by startTime on apply; the first point normally starts at [0,0,1]."
	return map[string]any{
		"beat":          mcpSchemaBeat("A chart position."),
		"bpmEntry":      bpmEntry,
		"controlPoint":  controlPoint,
		"chartObjectId": mcpSchemaString("Stable object id returned by redux_chart_read."),
		"chartMetadata": chartMetadata,
		"notePatch": func() map[string]any {
			node := mcpSchemaPatchObject(mcpSchemaWithout(noteValue, "id"))
			node["description"] = "Patch one note by id; omitted fields keep their value and the id is immutable."
			return node
		}(),
		"note": func() map[string]any {
			note := mcpSchemaObject(noteValue, "type", "startTime", "endTime", "positionX")
			note["description"] = "One note payload. Times are beats; id is optional on insert."
			note["additionalProperties"] = true
			return note
		}(),
		"noteInsert": mcpSchemaLineTarget(func() map[string]any {
			insert := mcpSchemaObject(
				map[string]any{
					"lineId": map[string]any{
						"$ref":        "#/$defs/chartObjectId",
						"description": "Owning judge line id from redux_chart_read. Provide lineId or lineIndex; when both are present they must match.",
					},
					"lineIndex": map[string]any{
						"type":        "integer",
						"minimum":     0,
						"description": "Zero-based judge line index. Provide lineId or lineIndex; when both are present they must match.",
					},
					"note": map[string]any{"$ref": "#/$defs/note"},
				},
				"note",
			)
			insert["description"] = "Insert one note into the line named by lineId or lineIndex. Omit note.id to let the editor assign it."
			return insert
		}()),
		"eventPatch": func() map[string]any {
			node := mcpSchemaPatchObject(mcpSchemaWithout(eventValue, "id"))
			node["description"] = "Patch one event by id. The id, owning line, eventType and layer are immutable; omitted fields keep their value."
			return node
		}(),
		"event": func() map[string]any {
			event := mcpSchemaObject(eventValue, "startTime", "endTime")
			event["description"] = "One event payload. Times are beats; id is optional on insert."
			event["additionalProperties"] = true
			return event
		}(),
		"eventInsert": mcpSchemaLineTarget(func() map[string]any {
			insert := mcpSchemaObject(
				map[string]any{
					"lineId": map[string]any{
						"$ref":        "#/$defs/chartObjectId",
						"description": "Owning judge line id from redux_chart_read. Provide lineId or lineIndex; when both are present they must match.",
					},
					"lineIndex": map[string]any{
						"type":        "integer",
						"minimum":     0,
						"description": "Zero-based judge line index. Provide lineId or lineIndex; when both are present they must match.",
					},
					"eventType": map[string]any{
						"type": "string",
						"enum": mcpEventTrackNames(),
						"description": "Track to insert into. Base tracks (moveX, moveY, rotate, alpha, speed) " +
							"default to layer 0; extended tracks default to the extended layer.",
					},
					"layer": map[string]any{
						"description": "Event layer for base tracks, or \"extended\" for extended tracks.",
						"anyOf": []any{
							map[string]any{"type": "integer", "minimum": 0},
							map[string]any{"type": "string", "enum": []string{"extended"}},
						},
					},
					"event": map[string]any{"$ref": "#/$defs/event"},
				},
				"eventType", "event",
			)
			insert["description"] = "Insert one event into the line named by lineId or lineIndex. Omit event.id to let the editor assign it."
			return insert
		}()),
		"lineInsert": func() map[string]any {
			node := mcpSchemaObject(map[string]any{
				"line": map[string]any{
					"$ref":        "#/$defs/linePatch",
					"description": "Editable fields for the new line. The editor assigns the id and default event layer; use lineIndex after insertion to target it.",
				},
			}, "line")
			node["description"] = "Insert one judge line. Use lineIndex for later operations in the same transaction, or read the new line id afterwards."
			return node
		}(),
		"linePatch": func() map[string]any {
			node := mcpSchemaPatchObject(map[string]any{
				"Name":             mcpSchemaString("Line name."),
				"Group":            map[string]any{"type": []string{"integer", "string"}, "description": "Line group index or name."},
				"Texture":          mcpSchemaString("Line texture resource."),
				"bpmfactor":        mcpSchemaNumber("Line BPM factor, greater than 0."),
				"father":           map[string]any{"type": []string{"integer", "string", "null"}, "description": "Numeric parent line index, or -1/null for none. Prefer parentId; do not send both."},
				"parentId":         map[string]any{"type": []string{"string", "null"}, "description": "Parent line id, or null to detach. API convenience over the format's numeric father field; do not send both."},
				"rotateWithFather": map[string]any{"type": "boolean", "description": "Follow the parent line's rotation."},
				"isCover":          mcpSchemaInteger("1 when notes behind the line are covered."),
				"zOrder":           mcpSchemaInteger("Draw order."),
				"anchor": map[string]any{
					"type":        "array",
					"items":       map[string]any{"type": "number"},
					"minItems":    2,
					"maxItems":    2,
					"description": "Anchor point.",
				},
				"isGif":        map[string]any{"type": "boolean", "description": "Texture is an animated GIF."},
				"attachUI":     mcpSchemaString("Attached UI resource."),
				"alphaControl": controlTrack("Alpha control points."),
				"posControl":   controlTrack("Horizontal position control points."),
				"sizeControl":  controlTrack("Size control points."),
				"skewControl":  controlTrack("Skew control points."),
				"yControl": controlTrack(
					"Vertical note-distance control. x is the note's signed distance from the line in chart units (not time); y multiplies that distance and defaults to 1. Applies to non-Hold notes only and does not add to moveYEvents: moveYEvents positions the line origin, while yControl scales each note's displacement from it.",
				),
			})
			node["description"] = "Patch one judge line by id. Structural fields (id, notes, eventLayers, extended, numOfNotes) stay owned by the editor."
			return node
		}(),
	}
}

// mcpChartTransactionNode is the `request` payload shared by validate and
// apply. Every operation array is optional, so an empty object is a valid no-op
// transaction; structural line fields (id, notes, eventLayers, numOfNotes,
// extended) are owned by the topology and are not patchable.
func mcpChartTransactionNode() map[string]any {
	updateNode := func(patchDef string) map[string]any {
		return map[string]any{
			"type": "array",
			"items": mcpSchemaObject(map[string]any{
				"id":    mcpSchemaObjectIdRef(),
				"patch": map[string]any{"$ref": "#/$defs/" + patchDef},
			}, "id", "patch"),
		}
	}
	timing := mcpSchemaObject(map[string]any{
		"bpmList": map[string]any{
			"type":        "array",
			"description": "Complete replacement tempo map, sorted by startTime when applied. It must contain at least one tempo point.",
			"items":       map[string]any{"$ref": "#/$defs/bpmEntry"},
			"minItems":    1,
		},
	}, "bpmList")
	timing["description"] = "Replace chart timing. This is the only way to set BPM; offset stays in metadata."
	schema := mcpSchemaObject(map[string]any{
		"label":    mcpSchemaString("Undo-history label for the transaction."),
		"metadata": map[string]any{"$ref": "#/$defs/chartMetadata"},
		"timing":   timing,
		"lines": mcpSchemaObject(map[string]any{
			"insert": map[string]any{
				"type":  "array",
				"items": map[string]any{"$ref": "#/$defs/lineInsert"},
			},
			"update": updateNode("linePatch"),
		}),
		"notes": mcpSchemaObject(map[string]any{
			"insert": map[string]any{
				"type":  "array",
				"items": map[string]any{"$ref": "#/$defs/noteInsert"},
			},
			"update": updateNode("notePatch"),
			"delete": deleteNode(),
		}),
		"events": mcpSchemaObject(map[string]any{
			"insert": map[string]any{
				"type":  "array",
				"items": map[string]any{"$ref": "#/$defs/eventInsert"},
			},
			"update": updateNode("eventPatch"),
			"delete": deleteNode(),
		}),
	})
	schema["description"] = "One atomic chart edit; omitted sections leave the chart unchanged. Metadata and patches accept extra format fields, while ids, notes, event layers and counts stay owned by the editor. timing.bpmList replaces the complete tempo map. lines.insert appends a judge line; lines.delete is not available. numOfNotes is derived from the note list and excludes Holds (type 2)."
	return schema
}

// deleteNode describes an array of object ids to delete.
func deleteNode() map[string]any {
	return map[string]any{
		"type":        "array",
		"description": "Object ids to delete.",
		"items":       mcpSchemaObjectIdRef(),
	}
}

// mcpChartTransactionDefinitionsWithRoot adds the transaction root to the shared
// definitions.
func mcpChartTransactionDefinitionsWithRoot() map[string]any {
	definitions := mcpChartTransactionDefinitions()
	definitions["chartTransaction"] = mcpChartTransactionNode()
	return definitions
}

// mcpSchemaExpectedRevisions describes the optional revision pins shared by
// validation and code-cell execution.
func mcpSchemaExpectedRevisions(description string) map[string]any {
	return map[string]any{
		"type":        "object",
		"description": description,
		"properties": map[string]any{
			"chartFingerprint": map[string]any{"type": []string{"string", "null"}, "description": "Expected chart fingerprint."},
			"diskSnapshot":     map[string]any{"type": []string{"string", "null"}, "description": "Expected disk snapshot."},
			"generation":       map[string]any{"type": "integer", "minimum": 0, "description": "Expected document generation."},
		},
		"additionalProperties": false,
	}
}

// mcpSchemaOrigin describes the optional audit origin shared by write tools.
func mcpSchemaOrigin(description string) map[string]any {
	return map[string]any{
		"type":        "object",
		"description": description,
		"properties": map[string]any{
			"clientId":  mcpSchemaString("Optional client identifier recorded in history.origin."),
			"requestId": mcpSchemaString("Optional request identifier recorded in history.origin."),
		},
		"additionalProperties": false,
	}
}

// mcpChartApplyInputSchema documents the write tool: one transaction plus the
// base fingerprint the write is checked against.
func mcpChartApplyInputSchema() map[string]any {
	schema := mcpSchemaObject(
		map[string]any{
			"request": map[string]any{
				"$ref":        "#/$defs/chartTransaction",
				"description": "One atomic chart transaction; see $defs.chartTransaction.",
			},
			"expectedChartFingerprint": mcpSchemaString(
				"revisions.chartFingerprint read from redux_document_state. The write is rejected as a conflict when the chart no longer matches.",
			),
			"origin": mcpSchemaOrigin(
				"Optional audit origin recorded on the history entry and echoed as history.origin in the apply response.",
			),
		},
		"request", "expectedChartFingerprint",
	)
	schema["$defs"] = mcpChartTransactionDefinitionsWithRoot()
	return schema
}

// mcpChartValidateInputSchema documents the dry-run tool: the same transaction
// plus an optional expected revision.
func mcpChartValidateInputSchema() map[string]any {
	schema := mcpSchemaObject(map[string]any{
		"request": map[string]any{
			"$ref":        "#/$defs/chartTransaction",
			"description": "Transaction to validate without applying it.",
		},
		"expected": mcpSchemaExpectedRevisions(
			"Optional revision pins; each supplied field must match the current document or the call returns stale_read.",
		),
	}, "request")
	schema["$defs"] = mcpChartTransactionDefinitionsWithRoot()
	return schema
}

// mcpCodeRunInputSchema documents the one-shot code cell. The description
// carries the runtime rules because the source is free-form.
func mcpCodeRunInputSchema() map[string]any {
	return mcpSchemaObject(map[string]any{
		"source": mcpSchemaString(
			"JavaScript async function body. It receives `redux` and `input`, may use `console`, and must return a JSON value. " +
				"The cell can read the open document, apply chart transactions, and add or remove project assets; it cannot save, open, close, or delete documents or projects. " +
				"Do not import modules, start timers, or access the DOM, network, or filesystem. " +
				"Call redux_code_guide once before writing a cell.",
		),
		"args": map[string]any{
			"type":                 "object",
			"additionalProperties": true,
			"description":          "Optional JSON object exposed to the cell as `input`.",
		},
		"expected": mcpSchemaExpectedRevisions(
			"Optional revision pins; a mismatch returns stale_read before the cell starts.",
		),
		"timeoutMs": map[string]any{
			"type":        "integer",
			"minimum":     1000,
			"maximum":     20000,
			"default":     10000,
			"description": "Execution budget in milliseconds; defaults to 10000 and is capped at 20000.",
		},
	}, "source")
}

// mcpChartReadInputSchema documents a paginated chart read. Lines come back in
// full; notes and events come back as id-addressed refs.
func mcpChartReadInputSchema() map[string]any {
	return mcpSchemaObject(map[string]any{
		"collection": map[string]any{
			"type": "string",
			"enum": []string{"metadata", "lines", "notes", "events"},
			"description": "metadata returns a one-item items array holding META, with name, song, background, " +
				"offset and the other chart header fields; lines returns each judge line in full (including " +
				"eventLayers and notes), and each line's numOfNotes is a derived scoring count that excludes " +
				"Holds (type 2); notes returns {id, lineId, lineIndex, index, note}; events returns " +
				"{id, lineId, lineIndex, eventType, layer, index, event}.",
		},
		"chartFingerprint": map[string]any{
			"type":        []string{"string", "null"},
			"description": "Optional expected fingerprint; a mismatch returns stale_read.",
		},
		"cursor": map[string]any{
			"type":        []string{"string", "null"},
			"description": "nextCursor from the previous page.",
		},
		"limit": map[string]any{
			"type":        "integer",
			"minimum":     1,
			"maximum":     100,
			"default":     50,
			"description": "Page size; defaults to 50 and is clamped to 100.",
		},
	}, "collection")
}
