/**
 * Hosts script guide requests and resolves each step's answer.
 *
 * The stack and its resolvers live here; the guide's frame, steps, and inputs are
 * rendered with the shared design controls.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Button } from "../../design/components/button/Button.tsx";
import { IconButton } from "../../design/components/button/IconButton.tsx";
import { ChoiceList } from "../../design/components/modal/ChoiceList.tsx";
import { PromptInput } from "../overlays/modals/PromptContent.tsx";
import { createValue } from "../../core/state/values.ts";
import type {
  ScriptUiGuideOptions,
  ScriptUiGuideResult,
  ScriptUiGuideStep,
  ScriptUiRequest,
} from "../../core/extensions/scriptUi.ts";
import { useTranslation } from "../../i18n/react.ts";

/** One open guide: its request, steps, current position, and collected values. */
interface ScriptGuideState {
  readonly id: number;
  readonly request: ScriptUiRequest;
  readonly options: ScriptUiGuideOptions;
  readonly step: number;
  readonly values: readonly (string | null)[];
}

const guides = createValue<readonly ScriptGuideState[]>({ initial: [] });
const resolvers = new Map<number, (result: ScriptUiGuideResult) => void>();
let nextId = 0;

/** Removes a guide and resolves its promise with the given status. */
function settle(id: number, status: ScriptUiGuideResult["status"]): void {
  const current = guides.get().find((guide) => guide.id === id);
  if (!current) {
    return;
  }
  current.request.signal.removeEventListener("abort", currentAbort(id));
  aborts.delete(id);
  guides.set(guides.get().filter((guide) => guide.id !== id));
  resolvers.get(id)?.({
    status,
    values: Object.freeze([...current.values]),
  });
  resolvers.delete(id);
}

const aborts = new Map<number, () => void>();

/** Returns the guide's abort handler, or one that cancels it. */
function currentAbort(id: number): () => void {
  return aborts.get(id) ?? (() => settle(id, "cancelled"));
}

/** Replaces part of one guide's state. */
function update(id: number, patch: Partial<Pick<ScriptGuideState, "step" | "values">>): void {
  guides.set(guides.get().map((guide) => (guide.id === id ? { ...guide, ...patch } : guide)));
}

/** Stores the answer chosen on the guide's current step. */
function updateValue(id: number, value: string | null): void {
  const current = guides.get().find((guide) => guide.id === id);
  if (!current) {
    return;
  }
  const values = [...current.values];
  values[current.step] = value;
  update(id, { values });
}

/** Queues a guide and resolves when it completes, is cancelled, or aborts. */
export function requestScriptGuide(
  request: ScriptUiRequest,
  options: ScriptUiGuideOptions,
): Promise<ScriptUiGuideResult> {
  if (request.signal.aborted) {
    return Promise.resolve({ status: "cancelled", values: [] });
  }
  if (!options.steps.length) {
    return Promise.resolve({ status: "completed", values: [] });
  }
  return new Promise((resolve) => {
    const id = ++nextId;
    const abort = () => settle(id, "cancelled");
    aborts.set(id, abort);
    resolvers.set(id, resolve);
    request.signal.addEventListener("abort", abort, { once: true });
    guides.set([
      ...guides.get(),
      {
        id,
        request,
        options,
        step: 0,
        values: Array.from({ length: options.steps.length }, () => null),
      },
    ]);
  });
}

/** Cancels every open guide, resolving each as cancelled. */
export function disposeScriptGuides(): void {
  for (const guide of [...guides.get()]) {
    settle(guide.id, "cancelled");
  }
}

/** Renders one step's description plus its input or choice control. */
function GuideStep({
  step,
  value,
  inputRef,
  choose,
}: {
  step: ScriptUiGuideStep;
  value: string | null;
  inputRef: { current: HTMLInputElement | HTMLTextAreaElement | null };
  choose(value: string): void;
}) {
  return (
    <>
      <h3>{step.title}</h3>
      {step.description && <p className="redux-script-guide-description">{step.description}</p>}
      {step.input && (
        <PromptInput
          inputRef={inputRef}
          title={step.input.title}
          defaultValue={value ?? step.input.defaultValue}
          placeholder={step.input.placeholder}
          multiline={step.input.multiline}
          submit={() => {}}
        />
      )}
      {step.select && (
        <ChoiceList
          choices={step.select.options.map((option, key) => ({
            key,
            label: option.label,
            disabled: option.disabled,
            selected: option.value === (value ?? step.select?.defaultValue),
          }))}
          onChoose={(key) => {
            const option = step.select?.options[key];
            if (option && !option.disabled) {
              choose(option.value);
            }
          }}
        />
      )}
    </>
  );
}

/** Guide card with progress, the active step, and its navigation footer. */
function ScriptGuideCard({ guide }: { guide: ScriptGuideState }) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const step = guide.options.steps[guide.step];

  useEffect(() => {
    inputRef.current?.focus();
  }, [guide.id, guide.step]);

  if (!step) {
    return null;
  }

  const saveInput = () => {
    if (step.input && inputRef.current) {
      updateValue(guide.id, inputRef.current.value);
    }
  };
  const cancel = () => settle(guide.id, "cancelled");
  const next = () => {
    saveInput();
    if (guide.step >= guide.options.steps.length - 1) {
      settle(guide.id, "completed");
      return;
    }
    update(guide.id, { step: guide.step + 1 });
  };
  const previous = () => {
    saveInput();
    update(guide.id, { step: Math.max(0, guide.step - 1) });
  };

  return (
    <article className="redux-script-guide" data-script-id={guide.request.source.id}>
      <header className="redux-script-guide-header">
        <div>
          <span className="redux-script-guide-source">{guide.request.source.name}</span>
          <h2>{guide.options.title}</h2>
        </div>
        <IconButton icon="close" size={16} label={t("common.action.close")} onClick={cancel} />
      </header>
      {guide.options.description && (
        <p className="redux-script-guide-description">{guide.options.description}</p>
      )}
      <div
        className="redux-script-guide-progress"
        aria-label={`${guide.step + 1}/${guide.options.steps.length}`}
      >
        <span style={{ width: `${((guide.step + 1) / guide.options.steps.length) * 100}%` }} />
      </div>
      <small className="redux-script-guide-count">
        {guide.step + 1} / {guide.options.steps.length}
      </small>
      <div className="redux-script-guide-content" key={`${guide.id}:${guide.step}`}>
        <GuideStep
          step={step}
          value={guide.values[guide.step]}
          inputRef={inputRef}
          choose={(value) => updateValue(guide.id, value)}
        />
      </div>
      <footer className="redux-script-guide-actions">
        <Button variant="outlined" onClick={cancel}>
          {guide.options.cancelLabel ?? t("common.action.cancel")}
        </Button>
        {guide.step > 0 && (
          <Button variant="outlined" onClick={previous}>
            {guide.options.previousLabel ?? t("common.action.previous")}
          </Button>
        )}
        <Button variant="solid" onClick={next}>
          {guide.step >= guide.options.steps.length - 1
            ? (guide.options.finishLabel ?? t("common.action.finish"))
            : (guide.options.nextLabel ?? t("common.action.next"))}
        </Button>
      </footer>
    </article>
  );
}

/** Portal host that shows the guide at the front of the queue. */
export function ScriptGuideHost() {
  const current = useSyncExternalStore(guides.subscribe, guides.get, guides.get)[0];
  if (!current || typeof document === "undefined") {
    return null;
  }
  return (
    <div className="redux-script-guides" aria-live="polite">
      <ScriptGuideCard guide={current} />
    </div>
  );
}
