/**
 * Owns the late-bound help handle exposed to extensions and automation. The
 * mounted frontend supplies the changelog and review-page actions.
 */
import { availabilityFor } from "./support.ts";
import type { ApiAvailability } from "./contract.ts";
import { createLateBound } from "../utils/lateBound.ts";
import { registerHelpTutorial, type HelpTutorialDefinition } from "../help/tutorialRegistry.ts";

/** Host actions behind the public help handle. */
export interface HelpHost {
  /** Opens the release notes; returns false when none were detected. */
  changelog(): boolean;
  /** Opens the categorized help review page. */
  guide(): void;
}

/** Tutorial registration API exposed to the host and Extensions. */
export interface HelpApi {
  availability(): ApiAvailability;
  openChangelog(): boolean;
  openGuide(): boolean;
  registerTutorial(definition: HelpTutorialDefinition): () => void;
}

/** The mounted help runtime, or null while unbound. */
const host = createLateBound<HelpHost>();

/**
 * Bind the mounted help runtime.
 *
 * Returns a disposer that clears this binding without affecting a newer one.
 */
export function connectHelpApi(value: HelpHost): () => void {
  return host.bind(value);
}

/** Direct help surfaces exposed to extensions and automation. */
/** Create an owner-scoped help registration surface. */
export function createHelpApi(owner?: string): HelpApi {
  return Object.freeze({
    /** Report whether a help runtime is connected. */
    availability(): ApiAvailability {
      return availabilityFor(host.value(), "No editor help runtime connected");
    },
    /** Open the release notes; false when no runtime or no notes are available. */
    openChangelog: (): boolean => host.value()?.changelog() ?? false,
    /** Open the categorized help review page; false when no runtime is connected. */
    openGuide: (): boolean => {
      const open = host.value()?.guide;
      open?.();
      return open !== undefined;
    },
    /** Register an Extension-owned tutorial in the Help review page. */
    registerTutorial: (definition: HelpTutorialDefinition) =>
      registerHelpTutorial(definition, owner),
  });
}

/** The complete host help facade. */
export const help = createHelpApi();

export type {
  HelpText,
  HelpTutorialPlacement,
  HelpTutorialStep,
  HelpTutorialDefinition,
} from "../help/tutorialRegistry.ts";
