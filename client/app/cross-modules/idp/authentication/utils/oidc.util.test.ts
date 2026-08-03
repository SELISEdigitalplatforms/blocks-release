import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildOIDCNavigationUrl,
  extractOIDCParams,
  getCurrentOIDCParams,
} from "./oidc.util";

const setLocation = (search: string, hash = "") => {
  const href = `https://app.example.com/oidc${search}${hash}`;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      search,
      hash,
      href,
      pathname: "/oidc",
    } as unknown as Location,
  });
};

describe("oidc.util", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    setLocation("");
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  describe("extractOIDCParams", () => {
    it("defaults the theme color when nothing is provided", () => {
      const params = extractOIDCParams();
      expect(params.themeColor).toBe("#124091");
    });

    it("reads params from the query string", () => {
      setLocation(
        "?x-blocks-key=key1&userName=jane&clientId=c1&logoUrl=http://logo&brandColor=aabbcc&state=s&nonce=n&scope=openid&redirect_uri=http://cb",
      );
      const params = extractOIDCParams();
      expect(params.projectKey).toBe("key1");
      expect(params.userName).toBe("jane");
      expect(params.clientId).toBe("c1");
      expect(params.logoUrl).toBe("http://logo");
      expect(params.themeColor).toBe("#aabbcc");
      expect(params.state).toBe("s");
      expect(params.nonce).toBe("n");
      expect(params.scope).toBe("openid");
      expect(params.redirectUri).toBe("http://cb");
    });

    it("normalizes a hashed color and hash params", () => {
      setLocation("", "#aabbcc&logoUrl=http://logo2&x-blocks-key=k2&clientId=c2&userName=u2&state=s2&nonce=n2&scope=sc2&redirect_uri=http://cb2");
      const params = extractOIDCParams();
      expect(params.themeColor).toBe("#aabbcc");
      expect(params.logoUrl).toBe("http://logo2");
      expect(params.projectKey).toBe("k2");
      expect(params.clientId).toBe("c2");
      expect(params.userName).toBe("u2");
      expect(params.state).toBe("s2");
      expect(params.nonce).toBe("n2");
      expect(params.scope).toBe("sc2");
      expect(params.redirectUri).toBe("http://cb2");
    });

    it("recovers a brandColor split into the hash by the # character", () => {
      setLocation("?brandColor=", "#112233");
      const params = extractOIDCParams();
      expect(params.themeColor).toBe("#112233");
    });

    it("falls back to the default when a color is malformed", () => {
      setLocation("?brandColor=notacolor");
      expect(extractOIDCParams().themeColor).toBe("#124091");
    });

    it("keeps a valid hash color for a hash that is not amp-delimited", () => {
      setLocation("", "#ddeeff");
      expect(extractOIDCParams().themeColor).toBe("#ddeeff");
    });

    it("extracts logoUrl from the full url when not in query", () => {
      setLocation("?brandColor=aabbcc#logoUrl=http://fromhash");
      const params = extractOIDCParams();
      expect(params.logoUrl).toBe("http://fromhash");
    });
  });

  describe("buildOIDCNavigationUrl", () => {
    it("returns the plain path when there are no params", () => {
      setLocation("");
      expect(buildOIDCNavigationUrl("/next")).toBe(
        "/next?brandColor=%23124091",
      );
    });

    it("preserves params on the built url", () => {
      setLocation("?x-blocks-key=key1&userName=jane&brandColor=aabbcc");
      const url = buildOIDCNavigationUrl("/signin");
      expect(url.startsWith("/signin?")).toBe(true);
      expect(url).toContain("x-blocks-key=key1");
      expect(url).toContain("userName=jane");
    });
  });

  describe("getCurrentOIDCParams", () => {
    it("returns a URLSearchParams with the current values", () => {
      setLocation("?x-blocks-key=key1&clientId=c1&brandColor=aabbcc");
      const sp = getCurrentOIDCParams();
      expect(sp.get("x-blocks-key")).toBe("key1");
      expect(sp.get("clientId")).toBe("c1");
      expect(sp.get("brandColor")).toBe("#aabbcc");
    });
  });
});
