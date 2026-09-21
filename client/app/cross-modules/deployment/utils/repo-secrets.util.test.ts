import { describe, expect, it } from "vitest";
import {
  exceedsSizeLimit,
  findDuplicateKey,
  getServerMessage,
  getServerReason,
  mapToEnv,
  mapToJson,
  mapToRows,
  parseSecretEnv,
  parseSecretJson,
  rowsToMap,
  validateSecretKey,
} from "./repo-secrets.util";
import { REPO_SECRET_MAX_BYTES } from "@blocks-deployment/models/repo-secrets.model";

describe("validateSecretKey", () => {
  it.each(["API_KEY", "_private", "a", "DB_2"])("accepts %s", (key) => {
    expect(validateSecretKey(key)).toBeNull();
  });

  it.each([
    ["", "A key is required."],
    ["db-password", "Start with a letter or underscore"],
    ["1DB", "Start with a letter or underscore"],
    ["has space", "Start with a letter or underscore"],
  ])("rejects %s", (key, fragment) => {
    expect(validateSecretKey(key)).toContain(fragment);
  });

  it("rejects a key over the length limit", () => {
    expect(validateSecretKey("A".repeat(129))).toContain("at most 128");
  });
});

describe("parseSecretJson", () => {
  it("parses a flat object of strings", () => {
    const result = parseSecretJson('{"API_KEY":"abc","EMPTY":""}');

    expect(result).toEqual({
      ok: true,
      value: { API_KEY: "abc", EMPTY: "" },
    });
  });

  it.each([
    ["", "Paste a JSON object."],
    ["   ", "Paste a JSON object."],
    ["not json", "This is not valid JSON."],
    ["[1,2]", "Provide a JSON object"],
    ["null", "Provide a JSON object"],
    ['"a string"', "Provide a JSON object"],
    ["{}", "Add at least one variable."],
    ['{"A":1}', 'The value for "A" must be text in quotes.'],
    ['{"A":{"b":"c"}}', 'The value for "A" must be text in quotes.'],
    ['{"A":["b"]}', 'The value for "A" must be text in quotes.'],
    ['{"A":null}', 'The value for "A" must be text in quotes.'],
    ['{"a-b":"c"}', "Start with a letter or underscore"],
  ])("rejects %s", (input, fragment) => {
    const result = parseSecretJson(input);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain(fragment);
  });

  it("rejects a set over the vault size limit", () => {
    const value = "x".repeat(REPO_SECRET_MAX_BYTES);
    const result = parseSecretJson(JSON.stringify({ K: value }));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("the maximum is");
  });
});

describe("exceedsSizeLimit", () => {
  it("returns null for a set within the limit", () => {
    expect(exceedsSizeLimit({ A: "b" })).toBeNull();
  });

  it("measures bytes, not characters", () => {
    // Each euro sign is three UTF-8 bytes, so a character count would wave this through.
    const value = "€".repeat(REPO_SECRET_MAX_BYTES / 2);

    expect(exceedsSizeLimit({ K: value })).toContain("bytes");
  });
});

describe("row helpers", () => {
  it("round-trips rows through a map", () => {
    const rows = [
      { key: "A", value: "1" },
      { key: "B", value: "" },
    ];

    expect(mapToRows(rowsToMap(rows))).toEqual(rows);
  });

  it("serializes a map for the JSON editor", () => {
    expect(mapToJson({ A: "1" })).toBe('{\n  "A": "1"\n}');
  });

  it("finds a duplicated key", () => {
    expect(
      findDuplicateKey([
        { key: "A", value: "1" },
        { key: "B", value: "2" },
        { key: "A", value: "3" },
      ]),
    ).toBe("A");
  });

  it("returns null when every key is unique", () => {
    expect(
      findDuplicateKey([
        { key: "A", value: "1" },
        { key: "B", value: "2" },
      ]),
    ).toBeNull();
  });
});

describe("server error extraction", () => {
  const error = {
    errors: {
      invalid_request: "Secret key 'a-b' is invalid.",
      reason: "SECRET_KEY_INVALID",
    },
  };

  it("reads the reason code", () => {
    expect(getServerReason(error)).toBe("SECRET_KEY_INVALID");
  });

  it("reads the human-facing message, skipping the reason", () => {
    expect(getServerMessage(error)).toBe("Secret key 'a-b' is invalid.");
  });

  it("returns null for an error with no envelope", () => {
    expect(getServerReason(new Error("boom"))).toBeNull();
    expect(getServerMessage(new Error("boom"))).toBeNull();
  });
});

describe("parseSecretEnv", () => {
  it("parses well-formed .env text (empty values, comments, blanks)", () => {
    const result = parseSecretEnv(`# comment
BLOCKS_APP_URL=

BLOCKS_API_BASE_URL=https://api.blocks.cloud
BLOCKS_X_BLOCKS_KEY=abc123
`);

    expect(result).toEqual({
      ok: true,
      value: {
        BLOCKS_APP_URL: "",
        BLOCKS_API_BASE_URL: "https://api.blocks.cloud",
        BLOCKS_X_BLOCKS_KEY: "abc123",
      },
    });
  });

  it("trims the key but keeps the value literal after the first =", () => {
    expect(parseSecretEnv("BLOCKS_IDP_BASE_URL =https://iam.seliseblocks.com")).toEqual({
      ok: true,
      value: { BLOCKS_IDP_BASE_URL: "https://iam.seliseblocks.com" },
    });
  });

  it("splits on the first = only so values may contain =", () => {
    expect(
      parseSecretEnv("BLOCKS_CALLBACK_URL=https://app.blocks.cloud/cb?x=1&y=2"),
    ).toEqual({
      ok: true,
      value: { BLOCKS_CALLBACK_URL: "https://app.blocks.cloud/cb?x=1&y=2" },
    });
  });

  it("rejects blank input", () => {
    const empty = parseSecretEnv("");
    expect(empty.ok).toBe(false);
    expect(empty.ok === false && empty.message).toBe(
      "Paste .env-formatted text, e.g. KEY=value.",
    );
    expect(parseSecretEnv("   ").ok).toBe(false);
  });

  it("rejects comments-only input", () => {
    const result = parseSecretEnv("# only\n\n# comments");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toBe("Add at least one variable.");
  });

  it("rejects a line with no =", () => {
    const result = parseSecretEnv("BLOCKS_APP_URL=https://a.com\nNOT_A_VARIABLE");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toBe("Line 2: expected KEY=VALUE.");
  });

  it("rejects an invalid key with validateSecretKey wording", () => {
    const result = parseSecretEnv("1BLOCKS_KEY=abc");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('key "1BLOCKS_KEY"');
    expect(result.ok === false && result.message).toContain(
      "Start with a letter or underscore",
    );
  });

  it("rejects a duplicate key naming both lines", () => {
    const result = parseSecretEnv("A=1\nA=2");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toBe(
      'Line 2: key "A" was already set on line 1.',
    );
  });

  it("rejects a set over the vault size limit", () => {
    const value = "x".repeat(REPO_SECRET_MAX_BYTES);
    const result = parseSecretEnv(`K=${value}`);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("maximum");
  });
});

describe("mapToEnv", () => {
  it("serializes a map as KEY=value lines in entry order", () => {
    expect(mapToEnv({ A: "1", B: "" })).toBe("A=1\nB=");
  });
});
