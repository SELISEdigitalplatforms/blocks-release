import { tStatic } from "@seliseblocks/genesis-os";

const MODULE = "release.deployment.shared";

/** Why GitHub would not put the webhook in the state the deployment mode needs (server `errors.webhook`). */
export const WEBHOOK_REASON_CODES = [
  "GITHUB_NOT_CONNECTED",
  "GITHUB_TOKEN_INVALID",
  "GITHUB_REPO_NOT_VISIBLE",
  "GITHUB_WEBHOOK_PERMISSION",
  "GITHUB_WEBHOOK_FAILED",
  "GITHUB_UNREACHABLE",
] as const;

/** A request that succeeded although the webhook is not in the state its mode asks for (server `warning.code`). */
export const WEBHOOK_WARNING_CODES = ["WEBHOOK_STILL_ACTIVE", "WEBHOOK_NOT_WORKING"] as const;

export type WebhookReasonCode = (typeof WEBHOOK_REASON_CODES)[number];
export type WebhookWarningCode = (typeof WEBHOOK_WARNING_CODES)[number];

/** The `warning` a deploy or a Settings save answers with when the webhook is not as its mode needs. */
export interface IDeploymentWarning {
  code: string;
  reason: string;
  /** English text for API callers; the UI shows its own text built from `code` and `reason`. */
  message: string;
  /** GitHub's own message, when it gave one. */
  detail?: string | null;
}

const isReasonCode = (value: unknown): value is WebhookReasonCode =>
  (WEBHOOK_REASON_CODES as readonly unknown[]).includes(value);

const isWarningCode = (value: unknown): value is WebhookWarningCode =>
  (WEBHOOK_WARNING_CODES as readonly unknown[]).includes(value);

/** The text of a reason code, with the repository's full name and GitHub's message filled in. */
export const webhookReasonText = (
  code: WebhookReasonCode,
  repo: string,
  detail?: string | null,
): string => tStatic(MODULE, `WEBHOOK_MESSAGES.${code}`, { repo, detail: detail ?? "" });

/**
 * The text for a refused request, or null when the error is not a webhook refusal (then the caller keeps its
 * usual failure text). The HTTP client hands the response's `errors` over as the error's `errors`.
 */
export const webhookRefusalText = (
  error: unknown,
  repo: string,
  { deploy }: { deploy: boolean },
): string | null => {
  const errors =
    typeof error === "object" && error !== null && "errors" in error
      ? (error as { errors?: Record<string, unknown> | null }).errors
      : null;
  const code = errors?.webhook;
  if (!isReasonCode(code)) return null;

  const detail = typeof errors?.webhookDetail === "string" ? errors.webhookDetail : null;
  const text = webhookReasonText(code, repo, detail);
  // A Blocks Cloud based deploy needs no webhook: deploy refusals say how to deploy anyway.
  return deploy ? `${text} ${tStatic(MODULE, "WEBHOOK_MESSAGES.DEPLOY_HINT")}` : text;
};

/**
 * The text for a response's `warning`, or null when there is none. A code this client does not know yet (a newer
 * server) shows the server's own message rather than hiding the warning.
 */
export const webhookWarningText = (
  warning: IDeploymentWarning | null | undefined,
  repo: string,
): string | null => {
  if (!warning) return null;
  if (!isWarningCode(warning.code) || !isReasonCode(warning.reason)) return warning.message || null;
  return tStatic(MODULE, `WEBHOOK_MESSAGES.${warning.code}`, {
    repo,
    reason: webhookReasonText(warning.reason, repo, warning.detail),
  });
};
