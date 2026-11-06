/** Compose React refs for a node owned by one visible frontend surface. */
import type { Ref, RefCallback } from "react";

/** Combines several React refs into one callback ref for a shared node. */
export function mergeRefs<T extends Element>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    }
  };
}
