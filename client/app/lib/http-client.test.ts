import { describe, expect, it, vi } from "vitest";

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
    const dep = mod.serviceInstances.deploymentService as unknown as {
      baseURL: () => string;
      blocksKey: () => string;
    };
    expect(typeof dep.baseURL()).toBe("string");
    expect(typeof dep.blocksKey()).toBe("string");
  });
});
