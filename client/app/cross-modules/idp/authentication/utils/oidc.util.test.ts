import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("oidc.util branch coverage", () => {
  const originalLocation = window.location;

  const setRawLocation = (search: string, hash: string, href: string) => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { search, hash, href, pathname: "/oidc" } as unknown as Location,
    });
  };

  const setLocation = (search: string, hash = "") =>
    setRawLocation(search, hash, `https://app.example.com/oidc${search}${hash}`);

  const allParamsQuery =
    "?x-blocks-key=qk&userName=qu&clientId=qc&logoUrl=http://ql&state=qs&nonce=qn&scope=qsc&redirect_uri=http://qr";

  const hashKeys = [
    "logoUrl",
    "x-blocks-key",
    "clientId",
    "userName",
    "state",
    "nonce",
    "scope",
    "redirect_uri",
  ];

  const allParamsHash = (prefix: string, value: (name: string) => string) =>
    `#${prefix}${hashKeys.map((key) => `${key}=${value(key)}`).join("&")}`;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  describe("extractOIDCParams", () => {
    it("returns only the default theme color outside a browser", () => {
      vi.stubGlobal("window", undefined);
      const params = extractOIDCParams();
      vi.unstubAllGlobals();
      expect(params).toEqual({ themeColor: "#124091" });
    });

    it("reads a brandColor that only appears inside a non-color hash", () => {
      setLocation("", "#lang=en&brandColor=aabbcc");
      const params = extractOIDCParams();
      expect(params.themeColor).toBe("#aabbcc");
      expect(params.projectKey).toBeUndefined();
      expect(params.logoUrl).toBeUndefined();
    });

    it("prefers the query brandColor over a hash color", () => {
      setLocation("?brandColor=aabbcc", "#112233");
      expect(extractOIDCParams().themeColor).toBe("#aabbcc");
    });

    it("uses the hash color when the decoded query brandColor is a bare ampersand", () => {
      // href deliberately omits the encoded value so the raw-url fallback finds nothing.
      setRawLocation("?brandColor=%26", "#112233", "https://app.example.com/oidc#112233");
      expect(extractOIDCParams().themeColor).toBe("#112233");
    });

    it("falls back to the default color when the raw url re-supplies an encoded ampersand", () => {
      setLocation("?brandColor=%26", "#112233");
      expect(extractOIDCParams().themeColor).toBe("#124091");
    });

    it("keeps query values over amp-delimited hash values", () => {
      setLocation(allParamsQuery, allParamsHash("aabbcc&", (k) => `h-${k}`));
      expect(extractOIDCParams()).toEqual({
        projectKey: "qk",
        userName: "qu",
        logoUrl: "http://ql",
        themeColor: "#aabbcc",
        clientId: "qc",
        state: "qs",
        nonce: "qn",
        scope: "qsc",
        redirectUri: "http://qr",
      });
    });

    it("leaves params undefined when an amp-delimited hash lacks them", () => {
      setLocation("", "#aabbcc&foo=bar");
      expect(extractOIDCParams()).toEqual({
        projectKey: undefined,
        userName: undefined,
        logoUrl: undefined,
        themeColor: "#aabbcc",
        clientId: undefined,
        state: undefined,
        nonce: undefined,
        scope: undefined,
        redirectUri: undefined,
      });
    });

    it("parses the whole hash as params when the color is not amp-delimited", () => {
      setLocation("", allParamsHash("aabbccx=1&", (k) => `h-${k}`));
      expect(extractOIDCParams()).toEqual({
        projectKey: "h-x-blocks-key",
        userName: "h-userName",
        logoUrl: "h-logoUrl",
        themeColor: "#aabbcc",
        clientId: "h-clientId",
        state: "h-state",
        nonce: "h-nonce",
        scope: "h-scope",
        redirectUri: "h-redirect_uri",
      });
    });

    it("treats empty values in a non-amp hash as undefined", () => {
      setLocation("", allParamsHash("aabbccx=1&", () => ""));
      expect(extractOIDCParams()).toEqual({
        projectKey: undefined,
        userName: undefined,
        logoUrl: undefined,
        themeColor: "#aabbcc",
        clientId: undefined,
        state: undefined,
        nonce: undefined,
        scope: undefined,
        redirectUri: undefined,
      });
    });

    it("keeps query values over a non-amp hash", () => {
      setLocation(allParamsQuery, allParamsHash("aabbccx=1&", (k) => `h-${k}`));
      const params = extractOIDCParams();
      expect(params.projectKey).toBe("qk");
      expect(params.logoUrl).toBe("http://ql");
      expect(params.redirectUri).toBe("http://qr");
    });

    describe("when the hash cannot be parsed", () => {
      const RealURLSearchParams = URLSearchParams;

      beforeEach(() => {
        class ThrowingURLSearchParams extends RealURLSearchParams {
          constructor(init?: string) {
            if (init === "aabbccbroken") throw new Error("boom");
            super(init);
          }
        }
        vi.stubGlobal("URLSearchParams", ThrowingURLSearchParams);
        setLocation("?clientId=c1", "#aabbccbroken");
      });

      it("logs the failure in debug mode and keeps the other values", () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const params = extractOIDCParams(true);
        expect(errorSpy).toHaveBeenCalledWith(
          "Failed to parse hash as params:",
          expect.objectContaining({ message: "boom" }),
        );
        expect(params.clientId).toBe("c1");
        expect(params.themeColor).toBe("#aabbcc");
      });

      it("stays silent outside debug mode", () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(extractOIDCParams().themeColor).toBe("#aabbcc");
        expect(errorSpy).not.toHaveBeenCalled();
      });
    });

    it("fully decodes a double-encoded logoUrl", () => {
      setLocation("?logoUrl=https%253A%252F%252Fcdn.example.com%252Flogo.png");
      expect(extractOIDCParams().logoUrl).toBe("https://cdn.example.com/logo.png");
    });

    it("keeps a logoUrl whose percent sequence cannot be decoded", () => {
      setLocation("?logoUrl=%25E0%25A4%25A");
      expect(extractOIDCParams().logoUrl).toBe("%E0%A4%A");
    });

    it("accepts a #-prefixed brandColor and truncates trailing query text", () => {
      setLocation("?brandColor=%2523aabbcc");
      expect(extractOIDCParams().themeColor).toBe("#aabbcc");
      setLocation("?brandColor=aabbcc%26extra%3D1");
      expect(extractOIDCParams().themeColor).toBe("#aabbcc");
    });
  });

  describe("buildOIDCNavigationUrl", () => {
    it("serialises every param in a fixed order", () => {
      setLocation(`${allParamsQuery}&brandColor=aabbcc`);
      expect(buildOIDCNavigationUrl("/next")).toBe(
        "/next?x-blocks-key=qk&userName=qu&clientId=qc&logoUrl=http%3A%2F%2Fql" +
          "&brandColor=%23aabbcc&state=qs&nonce=qn&scope=qsc&redirect_uri=http%3A%2F%2Fqr",
      );
    });
  });

  describe("getCurrentOIDCParams", () => {
    it("returns every param with brandColor last", () => {
      setLocation(allParamsQuery);
      expect(getCurrentOIDCParams().toString()).toBe(
        "x-blocks-key=qk&userName=qu&clientId=qc&logoUrl=http%3A%2F%2Fql" +
          "&state=qs&nonce=qn&scope=qsc&redirect_uri=http%3A%2F%2Fqr&brandColor=%23124091",
      );
    });

    it("returns only the default brandColor when nothing is set", () => {
      setLocation("");
      expect(getCurrentOIDCParams().toString()).toBe("brandColor=%23124091");
    });
  });
});
