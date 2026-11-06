/**
 * Words that mean the same thing everywhere in the interface.
 *
 * A string belongs here only when it is genuinely context-free. Context-specific
 * wording lives with the surface that owns the thing it describes.
 */
export default {
  "common.appName": "RPE Redux",

  "common.action.cancel": "Cancel",
  "common.action.previous": "Previous",
  "common.action.next": "Next",
  "common.action.finish": "Finish",
  "common.action.apply": "Apply",
  "common.action.confirm": "Confirm",
  "common.action.close": "Close",

  "common.action.save": "Save",
  "common.action.delete": "Delete",

  "common.action.rename": "Rename",
  "common.action.restore": "Restore",
  "common.action.resetField": "Reset {name} to its default",
  "common.action.resetHint": "Reset to default",
  "common.action.retry": "Try again",

  "common.action.clear": "Clear",
  "common.action.clearSearch": "Clear search",
  "common.action.copy": "Copy",
  "common.action.expand": "Expand",
  "common.action.collapse": "Collapse",
  "common.action.move": "Move",
  "common.action.reorder": "Reorder",

  "common.action.paste": "Paste",
  "common.action.undo": "Undo",
  "common.action.redo": "Redo",

  "common.language": "Language",
  "common.language.hint": "Applies to the whole interface; restarting is not required.",

  "common.settings.title": "Settings",
  "common.settings.search": "Search settings…",

  "extensions.parameters.required": "This value is required.",
  "extensions.parameters.number.invalid": "Enter a valid number.",
  "extensions.parameters.number.minimum": "The value must be at least {min}.",
  "extensions.parameters.number.maximum": "The value must be at most {max}.",
  "extensions.parameters.number.step": "The value must use a step of {step}.",
  "extensions.parameters.boolean.invalid": "Choose true or false.",
  "extensions.parameters.text.invalid": "Enter text.",
  "extensions.parameters.text.multiline": "Line breaks are not allowed here.",
  "extensions.parameters.text.tooLong": "Use at most {maxLength} characters.",
  "extensions.parameters.judgeLine.invalid": "Choose a valid judge line.",
  "extensions.parameters.judgeLine.count": "This parameter needs exactly {count} judge lines.",
  "extensions.parameters.judgeLine.range":
    "Provide at least {count} candidate judge lines for the random pick.",
  "extensions.parameters.judgeLine.unavailable":
    "This chart has fewer than {count} judge lines available.",
  "extensions.parameters.select.invalid": "Choose one of the available options.",
  "extensions.parameters.color.invalid": "Enter a colour in #rrggbb format.",
  "extensions.parameters.beat.invalid": "Enter a valid beat.",
  "extensions.parameters.expression.invalid": "Expression is invalid: {detail}",
  "extensions.parameters.expression.legend.notes":
    "Notes vocabulary: the fields above are read-only values from the selected note.",
  "extensions.parameters.expression.legend.events":
    "Events vocabulary: the fields above are read-only values from the selected event.",
  "extensions.parameters.expression.legend.indices":
    "n starts at 0 for notes and at 1 for events; i is always 0-based and N is the group size.",
  "extensions.parameters.expression.legend.progress":
    "u in a filter uses the unfiltered group; u in a value or script uses the filtered group.",
  "extensions.parameters.expression.legend.aliases":
    "The field list includes aliases: t/t1/st.time share the start beat, start/st.x share event start, and note v/w/width/yoffset/vt mirror note fields.",
  "extensions.parameters.expression.legend.functions":
    "Functions are supplied by the batch compiler; the function list above is authoritative.",
  "extensions.runLog.saveFailed":
    "Could not save the script run history; the script result was not affected.",

  /** A product mark rather than prose, so it reads the same in every language. */
} as const;
