/**
 * Native value writes for controlled inputs.
 *
 * React installs an instance-level value tracker on every input. Assigning
 * `element.value` updates that tracker as well, so the `input`/`change` event
 * fired afterwards looks unchanged and React never calls `onChange`. Writing
 * through the prototype setter bypasses the tracker while still updating the
 * DOM, which is what a programmatic control (stepper, colour picker, slider
 * editor) needs before it announces the change.
 */
export function writeInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
}
