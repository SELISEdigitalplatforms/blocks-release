import { describe, expect, it } from "vitest";
import { REPO_SECRET_MAX_BYTES } from "@blocks-deployment/models/repo-secrets.model";
import { activeTabResult, secretFormSchema, type ISecretFormValues } from "./secret-form-values";

const blank = { key: "", value: "" };

const kv = (rows: ISecretFormValues["rows"]): ISecretFormValues => ({
  mode: "kv",
  rows,
  json: "",
  env: "",
});

describe("activeTabResult", () => {
  it("parses the Env tab with the Env parser", () => {
    expect(activeTabResult({ mode: "env", rows: [blank], json: "", env: "A=1" })).toEqual({
      ok: true,
      value: { A: "1" },
    });
  });

  it("rejects a non-string value on the JSON tab with the JSON parser's message", () => {
    expect(activeTabResult({ mode: "json", rows: [blank], json: '{"A":1}', env: "" })).toEqual({
      ok: false,
      message: 'The value for "A" must be text in quotes.',
    });
  });

  it("ignores fully blank rows on the key/value tab", () => {
    expect(activeTabResult(kv([blank, { key: "A", value: "1" }, blank]))).toEqual({
      ok: true,
      value: { A: "1" },
    });
  });

  it("asks for a variable when every row is blank", () => {
    expect(activeTabResult(kv([blank, blank]))).toEqual({
      ok: false,
      message: "Add at least one variable.",
    });
  });

  it("still requires a key on a row that only has a value", () => {
    expect(activeTabResult(kv([{ key: "", value: "x" }]))).toEqual({
      ok: false,
      message: "A key is required.",
    });
  });

  it("rejects an invalid key", () => {
    expect(activeTabResult(kv([{ key: "1BAD", value: "x" }]))).toEqual({
      ok: false,
      message: "Start with a letter or underscore; letters, digits and underscore only.",
    });
  });

  it("rejects a duplicated key", () => {
    expect(
      activeTabResult(kv([{ key: "A", value: "1" }, blank, { key: "A", value: "2" }])),
    ).toEqual({ ok: false, message: "Each key may appear only once." });
  });

  it("rejects a set over the size limit", () => {
    const value = "x".repeat(REPO_SECRET_MAX_BYTES);

    expect(activeTabResult(kv([{ key: "A", value }]))).toEqual({
      ok: false,
      message: `This set is ${REPO_SECRET_MAX_BYTES + 8} bytes; the maximum is ${REPO_SECRET_MAX_BYTES}.`,
    });
  });
});

describe("secretFormSchema (key/value)", () => {
  it("accepts a trailing blank row", () => {
    expect(secretFormSchema.safeParse(kv([{ key: "A", value: "1" }, blank])).success).toBe(true);
  });

  it("puts a duplicate on the second occurrence, counting blank rows", () => {
    const result = secretFormSchema.safeParse(
      kv([{ key: "A", value: "1" }, blank, { key: "A", value: "2" }]),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["rows", 2, "key"]);
  });

  it("reports every invalid key on its own row", () => {
    const result = secretFormSchema.safeParse(
      kv([{ key: "1A", value: "" }, blank, { key: "b-c", value: "" }]),
    );

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([
      ["rows", 0, "key"],
      ["rows", 2, "key"],
    ]);
  });
});
