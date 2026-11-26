import { describe, expect, it } from "vitest";
import shared from "@/i18n/release.deployment.shared.en.json";
import {
  WEBHOOK_REASON_CODES,
  WEBHOOK_WARNING_CODES,
  webhookReasonText,
  webhookRefusalText,
  webhookWarningText,
} from "./webhook-messages";

const REPO = "org/app";
const HINT = "To deploy now, switch to Blocks Cloud based deployment in Settings.";

// The spec's §6.4 English, which the server sends as `message` too.
const REASON_TEXT: Record<string, string> = {
  GITHUB_NOT_CONNECTED: "Connect your GitHub account to use Git based deployment.",
  GITHUB_TOKEN_INVALID: "Your GitHub connection has expired. Reconnect GitHub and try again.",
  GITHUB_REPO_NOT_VISIBLE: "Your GitHub account can't access org/app.",
  GITHUB_WEBHOOK_PERMISSION:
    "Your GitHub account can't manage webhooks on org/app. Git based deployment needs a repository admin, or a role with the Manage webhooks permission.",
  GITHUB_WEBHOOK_FAILED:
    "GitHub couldn't set up the webhook on org/app: Resource protected by organization SAML enforcement.",
  GITHUB_UNREACHABLE: "GitHub didn't respond. Try again in a moment.",
};

describe("webhook messages", () => {
  it("has an English key for every reason and warning code (C17)", () => {
    for (const code of [...WEBHOOK_REASON_CODES, ...WEBHOOK_WARNING_CODES]) {
      expect(shared).toHaveProperty([`WEBHOOK_MESSAGES.${code}`]);
    }
    expect(shared).toHaveProperty(["WEBHOOK_MESSAGES.DEPLOY_HINT"]);
  });

  it.each(WEBHOOK_REASON_CODES)("reads the %s text from its key", (code) => {
    expect(
      webhookReasonText(code, REPO, "Resource protected by organization SAML enforcement."),
    ).toBe(REASON_TEXT[code]);
  });

  it("explains a refused Settings save without the deploy hint", () => {
    expect(
      webhookRefusalText({ errors: { webhook: "GITHUB_NOT_CONNECTED" } }, REPO, { deploy: false }),
    ).toBe("Connect your GitHub account to use Git based deployment.");
  });

  it("adds the deploy hint and GitHub's own message to a refused deploy (A1)", () => {
    expect(
      webhookRefusalText(
        {
          errors: {
            webhook: "GITHUB_WEBHOOK_FAILED",
            webhookDetail: "Resource protected by organization SAML enforcement.",
          },
        },
        REPO,
        { deploy: true },
      ),
    ).toBe(`${REASON_TEXT.GITHUB_WEBHOOK_FAILED} ${HINT}`);
  });

  it.each([
    ["no error", undefined],
    ["a plain message", { errors: { message: "Failed to update." } }],
    ["an unknown code", { errors: { webhook: "SOMETHING_ELSE" } }],
    ["null errors", { errors: null }],
    ["a string", "boom"],
  ])("leaves %s to the caller's usual text", (_label, error) => {
    expect(webhookRefusalText(error, REPO, { deploy: true })).toBeNull();
  });

  it("builds the still-active warning with its reason (H13)", () => {
    expect(
      webhookWarningText(
        {
          code: "WEBHOOK_STILL_ACTIVE",
          reason: "GITHUB_WEBHOOK_PERMISSION",
          message: "server text",
          detail: null,
        },
        REPO,
      ),
    ).toBe(
      `Push deploys are off. The GitHub webhook on org/app is still active: ${REASON_TEXT.GITHUB_WEBHOOK_PERMISSION}`,
    );
  });

  it("builds the not-working warning with its reason", () => {
    expect(
      webhookWarningText(
        {
          code: "WEBHOOK_NOT_WORKING",
          reason: "GITHUB_UNREACHABLE",
          message: "server text",
        },
        REPO,
      ),
    ).toBe(
      "Settings saved, but Git based deployment isn't working: GitHub didn't respond. Try again in a moment.",
    );
  });

  it("shows the server's message for a warning code it does not know", () => {
    expect(
      webhookWarningText(
        { code: "NEW_WARNING", reason: "NEW_REASON", message: "From the server." },
        REPO,
      ),
    ).toBe("From the server.");
  });

  it("has nothing to show without a warning", () => {
    expect(webhookWarningText(undefined, REPO)).toBeNull();
    expect(webhookWarningText(null, REPO)).toBeNull();
    expect(webhookWarningText({ code: "NEW", reason: "NEW", message: "" }, REPO)).toBeNull();
  });
});
