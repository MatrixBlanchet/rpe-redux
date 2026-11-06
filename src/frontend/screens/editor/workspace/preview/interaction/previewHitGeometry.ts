/** Precise painted note bounds for disambiguating overlapping preview objects. */
import type { HitTestNoteGeometry, HitTestPoint } from "../../../../../../core/edit/hitTest/api.ts";

/** Test the note's rotated useful rectangle, including the visible Hold caps. */
export function previewNoteContains(area: HitTestNoteGeometry, point: HitTestPoint): boolean {
  const angle = (area.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  /** Rotates a point into the note's local axes. */
  const project = (value: HitTestPoint) => {
    const x = value.x - area.head.x;
    const y = value.y - area.head.y;
    return { x: x * cos + y * sin, y: -x * sin + y * cos };
  };
  const cursor = project(point);
  if (area.kind === "note") {
    return Math.abs(cursor.x) <= area.width / 2 && Math.abs(cursor.y) <= (area.height ?? 0) / 2;
  }
  const tail = project(area.tail);
  const halfHead = (area.headLength ?? 0) / 2;
  const halfTail = (area.tailLength ?? 0) / 2;
  const progress = tail.y === 0 ? 0 : Math.max(0, Math.min(1, cursor.y / tail.y));
  return (
    Math.abs(cursor.x - tail.x * progress) <= area.width / 2 &&
    cursor.y >= Math.min(-halfHead, tail.y - halfTail) &&
    cursor.y <= Math.max(halfHead, tail.y + halfTail)
  );
}
