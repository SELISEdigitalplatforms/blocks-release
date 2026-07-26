import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { current: "Disconnected" };
const conn = {
  get state() {
    return state.current;
  },
  stop: vi.fn(),
};

vi.mock("@microsoft/signalr", () => {
  class HubConnectionBuilder {
    withUrl() {
      return this;
    }
    withAutomaticReconnect() {
      return this;
    }
    build() {
      return conn;
    }
  }
  return {
    HubConnectionBuilder,
    HubConnectionState: {
      Disconnected: "Disconnected",
      Connecting: "Connecting",
      Connected: "Connected",
      Reconnecting: "Reconnecting",
    },
    HttpTransportType: { WebSockets: 1 },
  };
});

describe("deployment-hub-client.service", () => {
  let mod: typeof import("./deployment-hub-client.service");

  beforeEach(async () => {
    vi.clearAllMocks();
    state.current = "Disconnected";
    conn.stop.mockResolvedValue(undefined);
    vi.resetModules();
    mod = await import("./deployment-hub-client.service");
  });

  it("connect is paused and returns null", async () => {
    expect(await mod.connectDeploymentHub("user-1")).toBeNull();
    expect(mod.getDeploymentHubConnection()).toBeNull();
  });

  it("disconnect is a no-op when there is no connection", async () => {
    await expect(mod.disconnectDeploymentHub()).resolves.toBeUndefined();
  });
});
