import { afterEach, describe, expect, it, vi } from "vitest";
import { getRuntimeEnv } from "@/lib/runtime-env";

vi.mock("@seliseblocks/genesis-os", () => ({
  HttpClient: class MockHttpClient {
    baseURL: () => string;
    blocksKey: () => string;
    constructor(opts: { baseURL: () => string; blocksKey: () => string }) {
      this.baseURL = opts.baseURL;
      this.blocksKey = opts.blocksKey;
    }
  },
}));

// Wrap the real resolver so the default behaviour is unchanged, while individual
// tests can make it return specific (or empty) values.
vi.mock("@/lib/runtime-env", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/runtime-env")>();
  return { getRuntimeEnv: vi.fn(actual.getRuntimeEnv) };
});

type Resolvers = { baseURL: () => string; blocksKey: () => string };

describe("http-client", () => {
  it("exposes the three service instances", async () => {
    const mod = await import("./http-client");
    expect(mod.serviceInstances.deploymentService).toBeTruthy();
    expect(mod.serviceInstances.logicService).toBeTruthy();
    expect(mod.serviceInstances.idpService).toBeTruthy();
    expect(mod.HttpClient).toBeTruthy();
  });

  it("wires the base url and blocks key resolvers", async () => {
    const mod = await import("./http-client");
    window.__BLOCKS_ENV__ = {
      ...window.__BLOCKS_ENV__,
      BLOCKS_API_BASE_URL: "https://shared-api.example.test",
    };
    const dep = mod.serviceInstances.deploymentService as unknown as {
      baseURL: () => string;
      blocksKey: () => string;
    };
    expect(dep.baseURL()).toBe(window.location.origin);
    expect(typeof dep.blocksKey()).toBe("string");
  });

  describe("resolver wiring per service", () => {
    const realImpl = vi.mocked(getRuntimeEnv).getMockImplementation();

    afterEach(() => {
      if (realImpl) vi.mocked(getRuntimeEnv).mockImplementation(realImpl);
    });

    const values: Record<string, string> = {
      BLOCKS_API_BASE_URL: "https://api.example.test",
      BLOCKS_LOGIC_BASE_URL: "https://logic.example.test",
      BLOCKS_IDP_BASE_URL: "https://idp.example.test",
      BLOCKS_X_BLOCKS_KEY: "blocks-key-1",
    };

    it.each([
      ["deploymentService", "BLOCKS_API_BASE_URL"],
      ["logicService", "BLOCKS_LOGIC_BASE_URL"],
      ["idpService", "BLOCKS_IDP_BASE_URL"],
    ] as const)(
      "%s resolves its base url from %s and the shared blocks key",
      async (service, baseKey) => {
        vi.mocked(getRuntimeEnv).mockImplementation((key) => values[key] ?? "");
        const mod = await import("./http-client");
        const client = mod.serviceInstances[service] as unknown as Resolvers;

        expect(client.baseURL()).toBe(values[baseKey]);
        expect(client.blocksKey()).toBe("blocks-key-1");
        expect(getRuntimeEnv).toHaveBeenCalledWith(baseKey);
        expect(getRuntimeEnv).toHaveBeenCalledWith("BLOCKS_X_BLOCKS_KEY");
      },
    );

    it.each(["deploymentService", "logicService", "idpService"] as const)(
      "%s falls back to empty strings when the env values are unset",
      async (service) => {
        vi.mocked(getRuntimeEnv).mockReturnValue("");
        const mod = await import("./http-client");
        const client = mod.serviceInstances[service] as unknown as Resolvers;

        expect(client.baseURL()).toBe("");
        expect(client.blocksKey()).toBe("");
      },
    );
  });
});
