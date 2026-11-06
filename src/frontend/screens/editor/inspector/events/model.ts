/**
 * Runtime state for the events pane: the current inspector snapshot, the
 * selection count, and an update generation for asynchronous builders.
 *
 * A late builder publishes only while its generation is current, which keeps a
 * slower selection from replacing a newer one. Created per editor tree.
 */
import { createValue, type ValueCell } from "../../../../../core/state/values.ts";
import type { ComponentType } from "react";
import type { EventInspectorViewProps } from "./EventInspectorView.tsx";
import type { ShaderInspectorViewProps } from "./shader/ShaderInspectorView.tsx";

export type EventInspectorSnapshot =
  | {
      kind: "event";
      component: ComponentType<EventInspectorViewProps>;
      props: EventInspectorViewProps;
    }
  | {
      kind: "shader";
      component: ComponentType<ShaderInspectorViewProps>;
      props: ShaderInspectorViewProps;
    }
  | null;

export interface EventInspectorState {
  inspector: ValueCell<EventInspectorSnapshot>;
  selectedCount: ValueCell<number | null>;
  beginUpdate(): number;
  isCurrentUpdate(candidate: number): boolean;
  clear(): void;
}

/** Creates event inspector state and its async revision guard per editor tree. */
export function createEventInspectorState(): EventInspectorState {
  const inspector = createValue<EventInspectorSnapshot>({ initial: null });
  const selectedCount = createValue<number | null>({ initial: null });
  let pendingUpdate = 0;
  return {
    inspector,
    selectedCount,
    beginUpdate: () => ++pendingUpdate,
    isCurrentUpdate: (candidate) => pendingUpdate === candidate,
    clear: () => {
      pendingUpdate++;
      inspector.set(null);
    },
  };
}
