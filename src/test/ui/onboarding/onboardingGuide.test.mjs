/** The guide model keeps every reference topic connected to a real walkthrough step. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  GUIDE_SECTIONS,
  guideSectionForContext,
  tutorialStepForGuideSection,
} from "../../../frontend/overlays/help/onboardingGuideContent.ts";
import { INSPECTOR_TUTORIALS } from "../../../frontend/screens/editor/inspector/tutorials.ts";

test("every guide topic can start the anchored walkthrough", () => {
  for (const section of GUIDE_SECTIONS) {
    assert.notEqual(tutorialStepForGuideSection(section.id), undefined, section.id);
  }
});

test("Inspector contexts start at the relevant walkthrough step", () => {
  assert.equal(tutorialStepForGuideSection(guideSectionForContext("inspector")), "parameters");
  assert.equal(tutorialStepForGuideSection(guideSectionForContext("metadata")), "metadata");
  assert.equal(tutorialStepForGuideSection(guideSectionForContext("curve-preview")), "sidebar");
});

test("inspector panels own distinct tutorial flows", () => {
  const entries = Object.entries(INSPECTOR_TUTORIALS);
  const ids = entries.map(([, tutorial]) => tutorial.id);
  assert.equal(new Set(ids).size, entries.length);
  assert.ok(entries.length >= 10);
  for (const [panelId, tutorial] of entries) {
    assert.ok(
      tutorial.activate?.id === panelId ||
        tutorial.steps.some((step) => step.targets?.includes(`inspector-panel-${panelId}`)),
      panelId,
    );
    assert.ok(new Set(tutorial.steps.map((step) => step.id)).size === tutorial.steps.length);
  }
});
