/** Linear easing keeps its direction placeholder in the normal field colour. */
import assert from "node:assert/strict";
import test from "node:test";
import { easingDirectionControlState } from "../design/components/easing/easingFieldModel.ts";

test("Linear direction placeholder is readable but not natively disabled", () => {
  assert.deepEqual(easingDirectionControlState(false, false), {
    disabled: false,
    ariaDisabled: true,
    tabIndex: -1,
  });
});

test("a disabled easing field still disables its direction control", () => {
  assert.deepEqual(easingDirectionControlState(false, true), {
    disabled: true,
    ariaDisabled: undefined,
    tabIndex: undefined,
  });
});
