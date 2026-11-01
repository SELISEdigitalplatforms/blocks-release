import { z } from "zod";
import {
  REPO_SECRET_KEY_MAX_LENGTH,
  REPO_SECRET_KEY_PATTERN,
} from "@blocks-deployment/models/repo-secrets.model";
import {
  dropBlankRows,
  exceedsSizeLimit,
  findDuplicateKey,
  isBlankRow,
  parseSecretEnv,
  parseSecretJson,
  rowsToMap,
  type ParseResult,
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
    if (values.mode === "json" || values.mode === "env") {
      refinePasteMode(values, ctx);
      return;
    }

    refineKvMode(values, ctx);
  });

const refinePasteMode = (
  values: ISecretFormValues,
  ctx: z.RefinementCtx,
): void => {
  const field = values.mode === "json" ? "json" : "env";
  const parsed =
    values.mode === "json"
      ? parseSecretJson(values.json)
      : parseSecretEnv(values.env);

  if (parsed.ok) return;

  ctx.addIssue({
    code: "custom",
    path: [field],
    message: parsed.message,
  });
};

type KvIssue = { path: (string | number)[]; message: string };

/**
 * The key/value rules, in the order they are reported. Shared by the schema (which puts every
 * issue on its row) and `activeTabResult` (which only needs the first), so Save enablement and
 * the on-screen messages cannot disagree.
 *
 * Fully blank rows are skipped rather than reported: "Add more" leaves one behind, and it must
 * neither block the save nor be carried into another tab. Indexes stay those of the full list so
 * a message still lands on the row the user sees.
 */
const kvIssues = (rows: ISecretFormValues["rows"]): KvIssue[] => {
  const issues: KvIssue[] = [];

  rows.forEach((row, index) => {
    if (isBlankRow(row)) return;

    const result = keyField.safeParse(row.key);

    if (!result.success) {
      issues.push({
        path: ["rows", index, "key"],
        message: result.error.issues[0]?.message ?? "Invalid key.",
      });
    }
  });

  if (issues.length > 0) return issues;

  const filled = dropBlankRows(rows);

  if (filled.length === 0) {
    return [{ path: ["rows"], message: "Add at least one variable." }];
  }

  const duplicate = findDuplicateKey(filled);

  if (duplicate) {
    return [
      {
        path: ["rows", indexOfDuplicate(rows, duplicate), "key"],
        message: "Each key may appear only once.",
      },
    ];
  }

  const tooLarge = exceedsSizeLimit(rowsToMap(filled));

  return tooLarge ? [{ path: ["rows"], message: tooLarge }] : [];
};

const refineKvMode = (values: ISecretFormValues, ctx: z.RefinementCtx): void => {
  for (const issue of kvIssues(values.rows)) {
    ctx.addIssue({ code: "custom", ...issue });
  }
};

/**
 * Parses whichever tab is on screen into the set Save would send. The single source for Save
 * enablement, the submit payload and the conversion on a tab switch.
 */
export const activeTabResult = (values: ISecretFormValues): ParseResult => {
  if (values.mode === "env") return parseSecretEnv(values.env);
  if (values.mode === "json") return parseSecretJson(values.json);

  const [first] = kvIssues(values.rows);

  return first
    ? { ok: false, message: first.message }
    : { ok: true, value: rowsToMap(dropBlankRows(values.rows)) };
};

/** Index of the second row that repeats `key`, or 0 as a safe fallback. */
const indexOfDuplicate = (
  rows: ISecretFormValues["rows"],
  key: string,
): number => {
  let seen = false;

  for (let i = 0; i < rows.length; i++) {
    if (rows[i].key === key) {
      if (seen) return i;
      seen = true;
    }
  }

  return 0;
};
