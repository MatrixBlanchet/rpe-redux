/** Owns the frozen facade for read-only preview and timeline hit testing. */
import { type ApiAvailability, type ApiResult } from "./contract.ts";
import { getHitTestApi } from "../edit/hitTest/api.ts";
import { availabilityFor, errorResult, frozenPoint, unavailableResult } from "./support.ts";
import type {
  HitTestApiHost,
  HitTestPreviewGeometry,
  HitTestRequest,
  HitTestResult,
} from "../edit/hitTest/api.ts";

/** Whether a request carries a known surface, finite point, and valid options. */
function validRequest(request: HitTestRequest): boolean {
  return Boolean(
    request &&
    (request.surface === "preview" || request.surface === "timeline") &&
    (request.area === undefined || request.area === "notes" || request.area === "events") &&
    Number.isFinite(request.point.x) &&
    Number.isFinite(request.point.y) &&
    (request.mode === undefined || request.mode === "topmost" || request.mode === "all") &&
    (request.tolerance === undefined ||
      (Number.isFinite(request.tolerance) && request.tolerance >= 0)),
  );
}

/** Freeze a result list and every result point. */
function frozenResults(results: readonly HitTestResult[]): readonly HitTestResult[] {
  return Object.freeze(
    results.map((result) =>
      Object.freeze({
        ...result,
        point: frozenPoint(result.point),
      }),
    ),
  );
}

/** A structured unavailable result for a call made before mount. */
function unavailable<T>(): ApiResult<T> {
  return unavailableResult<T>("No editor hit-test runtime connected");
}

/** Map a thrown host error onto the public error contract. */
function failure(error: unknown): ApiResult<readonly HitTestResult[]> {
  return errorResult(error);
}

/** Freeze the viewport, note, and line geometry of one preview frame. */
function frozenGeometry(geometry: HitTestPreviewGeometry): HitTestPreviewGeometry {
  return Object.freeze({
    ...geometry,
    viewport: Object.freeze({ ...geometry.viewport }),
    notes: Object.freeze(
      geometry.notes.map((note) =>
        Object.freeze({
          ...note,
          head: frozenPoint(note.head),
          tail: frozenPoint(note.tail),
        }),
      ),
    ),
    lines: Object.freeze(
      geometry.lines.map((line) =>
        Object.freeze({
          ...line,
          center: frozenPoint(line.center),
          corners: Object.freeze(line.corners.map((point) => frozenPoint(point))),
        }),
      ),
    ),
  });
}

/** Preview and timeline hit testing exposed to plugins. */
export const hitTest = Object.freeze({
  /** Report whether a hit-test runtime is connected. */
  availability(): ApiAvailability {
    return availabilityFor(getHitTestApi(), "No editor hit-test runtime connected");
  },
  /** Pick objects at one point; returns the topmost hit unless `mode` is "all". */
  pick(request: HitTestRequest): ApiResult<readonly HitTestResult[]> {
    if (!validRequest(request)) {
      return {
        ok: false,
        error: { code: "invalid_request", message: "Invalid hit-test request" },
      };
    }
    const api: HitTestApiHost | null = getHitTestApi();
    if (!api) {
      return unavailable();
    }
    try {
      const results = api.pick(request);
      return {
        ok: true,
        value: frozenResults(request.mode === "all" ? results : results.slice(0, 1)),
      };
    } catch (error) {
      return failure(error);
    }
  },
  /** The latest preview collision geometry, or unavailable when unsupported. */
  geometry(): ApiResult<HitTestPreviewGeometry> {
    const api: HitTestApiHost | null = getHitTestApi();
    if (!api) {
      return unavailable();
    }
    if (!api.getPreviewGeometry) {
      return {
        ok: false,
        error: { code: "unavailable", message: "Preview collision geometry is not supported" },
      };
    }
    try {
      const geometry = api.getPreviewGeometry();
      return geometry
        ? { ok: true, value: frozenGeometry(geometry) }
        : {
            ok: false,
            error: { code: "unavailable", message: "Preview collision geometry is unavailable" },
          };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "failed",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  },
});

export type {
  HitTestArea,
  HitTestKind,
  HitTestLineGeometry,
  HitTestMode,
  HitTestNoteGeometry,
  HitTestPoint,
  HitTestPreviewGeometry,
  HitTestRequest,
  HitTestResult,
  HitTestSurface,
} from "../edit/hitTest/api.ts";
