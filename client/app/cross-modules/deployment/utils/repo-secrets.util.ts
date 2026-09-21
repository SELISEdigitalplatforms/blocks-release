import { isErrorWithErrors } from "@/lib/error";
import {
  REPO_SECRET_KEY_MAX_LENGTH,
  REPO_SECRET_KEY_PATTERN,
  REPO_SECRET_MAX_BYTES,
  type RepoSecretMap,
} from "@blocks-deployment/models/repo-secrets.model";

/** One row of the key/value editor. */
export interface ISecretRow {
  key: string;
  value: string;
}

export type ParseResult =
  | { ok: true; value: RepoSecretMap }
  | { ok: false; message: string };

/**
 * Validates one key against the server's rule.
 *
 * Returns the message rather than throwing, so both the zod schema and the JSON parser can use
 * it and stay worded identically.
 */
export const validateSecretKey = (key: string): string | null => {
  if (!key) return "A key is required.";

  if (key.length > REPO_SECRET_KEY_MAX_LENGTH) {
    return `A key may be at most ${REPO_SECRET_KEY_MAX_LENGTH} characters.`;
  }

  if (!REPO_SECRET_KEY_PATTERN.test(key)) {
    return "Start with a letter or underscore; letters, digits and underscore only.";
  }

  return null;
};

/**
 * Parses pasted text into a validated map.
 *
 * Mirrors the server's rules so a mistake is caught before a round trip — the server re-validates
 * and stays the authority. Rejects arrays, nested objects and non-string values explicitly,
 * because "it is JSON" and "it is a secret set" are different questions.
 */
export const parseSecretJson = (text: string): ParseResult => {
  const trimmed = text.trim();

  if (!trimmed) {
    return { ok: false, message: "Paste a JSON object." };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, message: "This is not valid JSON." };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      ok: false,
      message: 'Provide a JSON object, for example {"API_KEY": "value"}.',
    };
  }

  const value: RepoSecretMap = {};

  for (const [key, raw] of Object.entries(parsed as Record<string, unknown>)) {
    const keyError = validateSecretKey(key);

    if (keyError) {
      return { ok: false, message: `Key "${key}": ${keyError}` };
    }

    if (typeof raw !== "string") {
      return {
        ok: false,
        message: `The value for "${key}" must be text in quotes.`,
      };
    }

    value[key] = raw;
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, message: "Add at least one variable." };
  }

  const tooLarge = exceedsSizeLimit(value);

  if (tooLarge) {
    return { ok: false, message: tooLarge };
  }

  return { ok: true, value };
};

/**
 * Parses pasted .env-style text into a validated map.
 *
 * Blank lines and #-comment lines are skipped. Keys are trimmed; values are kept exactly as
 * written after the first "=" (no trim, no quote-stripping). Fail-loud: any bad line rejects
 * the whole paste.
 */
export const parseSecretEnv = (text: string): ParseResult => {
  if (!text.trim()) {
    return { ok: false, message: "Paste .env-formatted text, e.g. KEY=value." };
  }

  const lines = text.split(/\r?\n/);
  const value: RepoSecretMap = {};
  const firstLineByKey = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const isBlank = !line.trim();
    const isComment = /^\s*#/.test(line);

    if (!(isBlank || isComment)) {
      const eq = line.indexOf("=");

      if (eq === -1) {
        return { ok: false, message: `Line ${lineNum}: expected KEY=VALUE.` };
      }

      const key = line.slice(0, eq).trim();
      const rawValue = line.slice(eq + 1);
      const keyError = validateSecretKey(key);

      if (keyError) {
        return {
          ok: false,
          message: `Line ${lineNum}, key "${key}": ${keyError}`,
        };
      }

      const firstSeenLine = firstLineByKey.get(key);

      if (firstSeenLine !== undefined) {
        return {
          ok: false,
          message: `Line ${lineNum}: key "${key}" was already set on line ${firstSeenLine}.`,
        };
      }

      firstLineByKey.set(key, lineNum);
      value[key] = rawValue;
    }
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, message: "Add at least one variable." };
  }

  const tooLarge = exceedsSizeLimit(value);

  if (tooLarge) {
    return { ok: false, message: tooLarge };
  }

  return { ok: true, value };
};

/**
 * Returns a message when the serialized set is over Key Vault's limit, otherwise null.
 * Measured in bytes, like the server, so a multi-byte set is not waved through.
 */
export const exceedsSizeLimit = (secrets: RepoSecretMap): string | null => {
  const bytes = new TextEncoder().encode(JSON.stringify(secrets)).length;

  return bytes > REPO_SECRET_MAX_BYTES
    ? `This set is ${bytes} bytes; the maximum is ${REPO_SECRET_MAX_BYTES}.`
    : null;
};

export const rowsToMap = (rows: ISecretRow[]): RepoSecretMap =>
  rows.reduce<RepoSecretMap>((map, row) => {
    map[row.key] = row.value;
    return map;
  }, {});

export const mapToRows = (secrets: RepoSecretMap): ISecretRow[] =>
  Object.entries(secrets).map(([key, value]) => ({ key, value }));

export const mapToJson = (secrets: RepoSecretMap): string =>
  JSON.stringify(secrets, null, 2);

export const mapToEnv = (secrets: RepoSecretMap): string =>
  Object.entries(secrets)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

export const findDuplicateKey = (rows: ISecretRow[]): string | null => {
  const seen = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.key)) return row.key;
    seen.add(row.key);
  }

  return null;
};

/**
 * Pulls the machine-readable reason code off a platform error envelope.
 *
 * The backend puts it under `errors.reason`; everything else in that object is human-facing text.
 */
export const getServerReason = (error: unknown): string | null => {
  if (!isErrorWithErrors(error)) return null;

  const reason = error.errors["reason"];

  return typeof reason === "string" ? reason : null;
};

/**
 * The human-facing half of the same envelope — the first non-`reason` entry.
 * Used for the form-level banner, where the server's own wording is better than ours.
 */
export const getServerMessage = (error: unknown): string | null => {
  if (!isErrorWithErrors(error)) return null;

  for (const [key, value] of Object.entries(error.errors)) {
    if (key === "reason") continue;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length > 0) return value.join(", ");
  }

  return null;
};
