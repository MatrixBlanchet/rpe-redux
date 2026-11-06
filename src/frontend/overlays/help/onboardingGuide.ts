/** Imperative entry point for a contextual, anchored tutorial. */
import { onboardingReplayChoice, startOnboardingTour } from "../../onboarding/state.ts";
import { tutorialStepForGuideSection, type GuideSectionId } from "./onboardingGuideContent.ts";
import { getHelpTutorial } from "../../../core/help/tutorialRegistry.ts";

/** Starts the tutorial step that belongs to the requested shell context. */
export function openOnboardingGuide(section: GuideSectionId = "overview"): void {
  startOnboardingTour({
    choice: onboardingReplayChoice(),
    stepId: tutorialStepForGuideSection(section),
  });
}

/** Starts one registered tutorial at its first step. */
export function openOnboardingTutorial(tutorialId: string): boolean {
  const tutorial = getHelpTutorial(tutorialId);
  const firstStep = tutorial?.steps[0];
  if (!tutorial || !firstStep) {
    return false;
  }
  startOnboardingTour({
    choice: onboardingReplayChoice(),
    tutorialId: tutorial.id,
    stepId: firstStep.id,
  });
  return true;
}
