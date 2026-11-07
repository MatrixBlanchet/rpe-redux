/** Linear easing disables its direction placeholder while keeping it visible. */
import assert from "node:assert/strict";
import test from "node:test";
import { easingDirectionControlState } from "../../../design/components/easing/easingFieldModel.ts";

test("Linear direction placeholder is natively disabled", () => {
  assert.deepEqual(easingDirectionControlState(false, false), {
    disabled: true,
    ariaDisabled: undefined,
    tabIndex: undefined,
  });
});

test("a disabled easing field still disables its direction control", () => {
  assert.deepEqual(easingDirectionControlState(false, true), {
    disabled: true,
    ariaDisabled: undefined,
    tabIndex: undefined,
  });
});
