/** Chooses which event value groups and curves fit in the visible event field. */
import type { JudgeLineEvent } from "../../../../../../core/global/chart/chart.ts";
import type { EventChain } from "../../../../../../core/edit/timeline/eventChains.ts";

const EVENT_VALUE_LABEL_SPACING = 28;
const EVENT_CURVE_DENSITY = 0.1;

export interface EventLabelBounds {
  readonly top: number;
  readonly bottom: number;
}

/** Choose the event value groups that fit in the field's label budget. */
export function labelGroups(
  groups: Iterable<EventChain<JudgeLineEvent> | undefined>,
  height: number,
  isSelected: (group: EventChain<JudgeLineEvent>) => boolean,
  boundsFor?: (group: EventChain<JudgeLineEvent>) => EventLabelBounds,
): EventChain<JudgeLineEvent>[] {
  const visible = Array.from(new Set(groups)).filter(
    (group): group is EventChain<JudgeLineEvent> => group !== undefined,
  );
  const budget = Math.max(1, Math.floor(Math.max(0, height - 23) / EVENT_VALUE_LABEL_SPACING));
  if (boundsFor) {
    const selected = visible.filter(isSelected);
    const ordered = [...visible].sort((left, right) => {
      const leftSelected = isSelected(left) ? 0 : 1;
      const rightSelected = isSelected(right) ? 0 : 1;
      if (leftSelected !== rightSelected) {
        return leftSelected - rightSelected;
      }
      const leftBounds = boundsFor(left);
      const rightBounds = boundsFor(right);
      return (leftBounds.top + leftBounds.bottom) / 2 - (rightBounds.top + rightBounds.bottom) / 2;
    });
    const kept: EventChain<JudgeLineEvent>[] = [];
    for (const group of ordered) {
      const center = (boundsFor(group).top + boundsFor(group).bottom) / 2;
      const selectedGroup = selected.includes(group);
      const crowded = kept.some((candidate) => {
        const candidateBounds = boundsFor(candidate);
        return (
          Math.abs((candidateBounds.top + candidateBounds.bottom) / 2 - center) <
          EVENT_VALUE_LABEL_SPACING
        );
      });
      if ((!crowded || selectedGroup) && kept.length < budget) {
        kept.push(group);
      }
    }
    return visible.filter((group) => kept.includes(group));
  }
  if (visible.length <= budget) {
    return visible;
  }
  const selected = visible.filter(isSelected);
  const selectedStep = Math.max(1, Math.ceil(selected.length / budget));
  const selectedVisible = new Set(
    selected.filter((_, index) => index % selectedStep === 0).slice(0, budget),
  );
  const remaining = Math.max(0, budget - selectedVisible.size);
  if (remaining === 0) {
    return visible.filter((group) => selectedVisible.has(group));
  }
  const unselected = visible.filter((group) => !selectedVisible.has(group));
  const step = Math.max(1, Math.ceil(unselected.length / remaining));
  let unselectedIndex = 0;
  return visible.filter((group) => {
    if (selectedVisible.has(group)) {
      return true;
    }
    const include = unselectedIndex % step === 0;
    unselectedIndex++;
    return include;
  });
}

/** Curves stay off once the visible event count would make them dense. */
export function shouldDrawEventCurves(eventCount: number, height: number): boolean {
  const availableHeight = Math.max(1, height - 23);
  return eventCount <= Math.max(128, Math.floor(availableHeight * EVENT_CURVE_DENSITY));
}
