/**
 * The shared failure panel for GitHub and marketplace Extension installs.
 *
 * It shows the stable code and phase first, then the request, detail, cause,
 * and recovery hint. The panel is deliberately complete: a failed install must
 * tell the user which step failed even when the underlying error is opaque.
 */
import type { ExtensionInstallFailure } from "../../../../core/extensions/install.ts";
import { useTranslation } from "../../../../i18n/react.ts";
import type { MessageKey, MessageParams } from "../../../../i18n/index.ts";

/** Localized sentence for one stable install failure code. */
export function installFailureMessage(
  failure: ExtensionInstallFailure,
  translate: (key: MessageKey, params?: MessageParams) => string,
): string {
  const key = `settings.extensions.install.error.${failure.code}` as MessageKey;
  return translate(key);
}

/** Localized label for the phase that failed. */
export function installPhaseLabel(
  phase: ExtensionInstallFailure["phase"],
  translate: (key: MessageKey, params?: MessageParams) => string,
): string {
  return translate(`settings.extensions.install.phase.${phase}` as MessageKey);
}

/** Render every fact a structured install failure carries. */
export function ExtensionInstallError({ failure }: { failure: ExtensionInstallFailure }) {
  const { t } = useTranslation();
  return (
    <div className="redux-extension-error" role="alert">
      <p className="modal-error">{installFailureMessage(failure, t)}</p>
      <dl className="redux-extension-error-facts">
        <dt>{t("settings.extensions.install.error.code")}</dt>
        <dd>
          <code>{failure.code}</code>
        </dd>
        <dt>{t("settings.extensions.install.error.phase")}</dt>
        <dd>{installPhaseLabel(failure.phase, t)}</dd>
        {failure.source && (
          <>
            <dt>{t("settings.extensions.install.error.source")}</dt>
            <dd className="redux-extension-error-source">{failure.source}</dd>
          </>
        )}
        {failure.status !== undefined && (
          <>
            <dt>{t("settings.extensions.install.error.status")}</dt>
            <dd>{failure.status}</dd>
          </>
        )}
      </dl>
      {failure.detail && (
        <>
          <p className="redux-extension-error-label">
            {t("settings.extensions.install.error.detail")}
          </p>
          <pre className="redux-extension-review-log">{failure.detail}</pre>
        </>
      )}
      {failure.causeMessage && (
        <>
          <p className="redux-extension-error-label">
            {t("settings.extensions.install.error.cause")}
          </p>
          <pre className="redux-extension-review-log">{failure.causeMessage}</pre>
        </>
      )}
      {failure.hint && (
        <p className="redux-extension-error-hint">
          {t("settings.extensions.install.error.hint")}: {failure.hint}
        </p>
      )}
    </div>
  );
}
