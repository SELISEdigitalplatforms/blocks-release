import { z } from "zod";
import {
  REPO_SECRET_KEY_MAX_LENGTH,
  REPO_SECRET_KEY_PATTERN,
} from "@blocks-deployment/models/repo-secrets.model";
import {
  exceedsSizeLimit,
  findDuplicateKey,
  parseSecretEnv,
  parseSecretJson,
  rowsToMap,
} from "@blocks-deployment/utils/repo-secrets.util";

export type SecretEntryMode = "kv" | "json" | "env";

export interface ISecretFormValues {
  mode: SecretEntryMode;
  rows: { key: string; value: string }[];
  json: string;
  env: string;
}

/**
 * Field-level rules, shared by both entry modes so the wording cannot drift between them.
 *
 * These mirror the server's validation to save a round trip; they never replace it. The server
 * re-validates every save and its 400 is routed back onto the offending field.
 */
const keyField = z
  .string()
  .min(1, "A key is required.")
  .max(
    REPO_SECRET_KEY_MAX_LENGTH,
    `A key may be at most ${REPO_SECRET_KEY_MAX_LENGTH} characters.`,
  )
  .regex(
    REPO_SECRET_KEY_PATTERN,
    "Start with a letter or underscore; letters, digits and underscore only.",
  );

/** Empty is legitimate — a blank string is a valid secret value. */
const valueField = z.string();

/**
 * One schema for all modes, switched by `mode`.
 *
 * Kept as a single schema rather than three so the form keeps one resolver across a mode switch;
 * swapping resolvers mid-edit would discard the errors already on screen.
 *
 * The object shape deliberately accepts any string as a row key: shape validation runs for all
 * modes, so enforcing `keyField` there failed the whole form on the rows the user is not editing.
 * In JSON/Env mode those rows still hold whatever the key/value editor was last seeded with - for a
 * new set, one blank row - and a blank key made every paste-mode save fail on `rows.0.key`, a field
 * that is not on screen in that mode. Submit became a no-op with nothing to explain it. The key
 * rules therefore live in the refinement below, which only reaches them in key/value mode.
 */
export const secretFormSchema = z
  .object({
    mode: z.enum(["kv", "json", "env"]),
    rows: z.array(z.object({ key: z.string(), value: valueField })),
    json: z.string(),
    env: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.mode === "json") {
      const parsed = parseSecretJson(values.json);

      if (!parsed.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["json"],
          message: parsed.message,
        });
      }

      return;
    }

    if (values.mode === "env") {
      const parsed = parseSecretEnv(values.env);

      if (!parsed.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["env"],
          message: parsed.message,
        });
      }

      return;
    }

    // Each key is checked against the shared field rules and reported on its own row, so the
    // wording still cannot drift between the modes.
    let hasInvalidKey = false;

    values.rows.forEach((row, index) => {
      const result = keyField.safeParse(row.key);

      if (result.success) return;

      hasInvalidKey = true;

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rows", index, "key"],
        message: result.error.issues[0]?.message ?? "Invalid key.",
      });
    });

    // Duplicate and size checks read the keys, so they are only meaningful once every key is
    // valid; running them on a half-typed set would stack a second error onto the same row.
    if (hasInvalidKey) return;

    if (values.rows.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rows"],
        message: "Add at least one variable.",
      });

      return;
    }

    // Reported on the offending row rather than the array, so the user sees which one to fix.
    const duplicate = findDuplicateKey(values.rows);

    if (duplicate) {
      const index = values.rows.findIndex((row, i) => {
        return values.rows.findIndex((r) => r.key === row.key) !== i;
      });

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rows", index, "key"],
        message: "Each key may appear only once.",
      });

      return;
    }

    const tooLarge = exceedsSizeLimit(rowsToMap(values.rows));

    if (tooLarge) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rows"],
        message: tooLarge,
      });
    }
  });
