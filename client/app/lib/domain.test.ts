import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDomain,
  getProjectBlocksApiUrl,
  getSubdomain,
  isValidDomain,
  isValidSubdomain,
} from "./domain";
import type { IProject } from "@blocks-identifier/models/project.model";

describe("domain utils", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("isValidDomain", () => {
    it("accepts a valid https domain", () => {
      expect(isValidDomain("https://example.com")).toBe(true);
    });

    it("accepts a valid http domain with subdomain", () => {
      expect(isValidDomain("http://app.example.com")).toBe(true);
    });

    it("trims surrounding whitespace", () => {
      expect(isValidDomain("  https://example.com  ")).toBe(true);
    });

    it("rejects a value without protocol", () => {
      expect(isValidDomain("example.com")).toBe(false);
    });

    it("rejects an empty string", () => {
      expect(isValidDomain("")).toBe(false);
    });
  });

  describe("isValidSubdomain", () => {
    it("returns false for empty input", () => {
      expect(isValidSubdomain("")).toBe(false);
    });

    it("accepts a single protocol-prefixed label", () => {
      expect(isValidSubdomain("https://app")).toBe(true);
    });

    it("rejects when a later label lacks the protocol", () => {
      expect(isValidSubdomain("https://app.example.com")).toBe(false);
    });
  });

  describe("getDomain", () => {
    it("returns the registrable domain for a valid url", () => {
      expect(getDomain("https://app.example.com")).toBe("example.com");
    });

    it("returns empty string for an invalid url", () => {
      expect(getDomain("not-a-url")).toBe("");
    });

    it("defaults to empty input", () => {
      expect(getDomain()).toBe("");
    });
  });

  describe("getSubdomain", () => {
    it("returns empty string for empty input", () => {
      expect(getSubdomain("")).toBe("");
    });

    it("returns empty string for invalid url", () => {
      expect(getSubdomain("nope")).toBe("");
    });

    it("returns empty string when there is no subdomain", () => {
      expect(getSubdomain("https://example.com")).toBe("");
    });

    it("returns the subdomain url when present", () => {
      expect(getSubdomain("https://app.example.com")).toBe("https://app");
    });

    it("returns nested subdomains", () => {
      expect(getSubdomain("https://a.b.example.com")).toBe("https://a.b");
    });
  });

  describe("getProjectBlocksApiUrl", () => {
    it("returns empty string when project is undefined", () => {
      expect(getProjectBlocksApiUrl(undefined)).toBe("");
    });

    it("returns empty string when the base url env is not set", () => {
      vi.stubEnv("VITE_PROJECT_DEFAULT_API_BASE_URL", "");
      expect(getProjectBlocksApiUrl({ customDomain: "" } as IProject)).toBe("");
    });

    it("returns the base url when there is no custom domain", () => {
      vi.stubEnv("VITE_PROJECT_DEFAULT_API_BASE_URL", "https://base.api");
      expect(getProjectBlocksApiUrl({ customDomain: "" } as IProject)).toBe(
        "https://base.api",
      );
    });

    it("derives the api host from a custom domain", () => {
      vi.stubEnv("VITE_PROJECT_DEFAULT_API_BASE_URL", "https://base.api");
      expect(
        getProjectBlocksApiUrl({
          customDomain: "https://app.example.com",
        } as IProject),
      ).toBe("blocksapi.example.com");
    });
  });
});
