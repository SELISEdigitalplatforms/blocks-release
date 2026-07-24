import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = { current: "Disconnected" };
const conn = {
  get state() {
    return state.current;
  },
  onreconnecting: vi.fn(),
  onreconnected: vi.fn(),
  onclose: vi.fn(),
  start: vi.fn(),
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

type MutableWindow = typeof window & { __BLOCKS_ENV__?: Record<string, string> };

describe("notification-hub-client.service", () => {
  let mod: typeof import("./notification-hub-client.service");

  beforeEach(async () => {
    vi.clearAllMocks();
    state.current = "Disconnected";
    conn.start.mockResolvedValue(undefined);
    conn.stop.mockResolvedValue(undefined);
    (window as MutableWindow).__BLOCKS_ENV__ = {
      BLOCKS_LOGIC_BASE_URL: "https://dev-logic.blocksdevelopers.com",
      BLOCKS_X_BLOCKS_KEY: "key-123",
    };
    vi.resetModules();
    mod = await import("./notification-hub-client.service");
  });

  afterEach(() => {
    (window as MutableWindow).__BLOCKS_ENV__ = {
      BLOCKS_LOGIC_BASE_URL: "https://dev-logic.blocksdevelopers.com",
    };
  });

  it("starts a connection and wires the reconnect handlers", async () => {
    const result = await mod.connectNotificationHub();
    expect(result).toBe(conn);
    expect(conn.start).toHaveBeenCalledTimes(1);
    expect(conn.onreconnecting).toHaveBeenCalled();
    expect(conn.onreconnected).toHaveBeenCalled();
    expect(conn.onclose).toHaveBeenCalled();
    expect(mod.getNotificationHubConnection()).toBe(conn);
  });

  it("returns null when the logic base url is not configured", async () => {
    (window as MutableWindow).__BLOCKS_ENV__ = { BLOCKS_LOGIC_BASE_URL: "" };
    vi.resetModules();
    const fresh = await import("./notification-hub-client.service");
    expect(await fresh.connectNotificationHub()).toBeNull();
  });

  it("reuses an already-connected connection without starting again", async () => {
    await mod.connectNotificationHub();
    state.current = "Connected";
    conn.start.mockClear();
    const again = await mod.connectNotificationHub();
    expect(again).toBe(conn);
    expect(conn.start).not.toHaveBeenCalled();
  });

  it("swallows a failed start and still returns the connection", async () => {
    conn.start.mockRejectedValue(new Error("boom"));
    const result = await mod.connectNotificationHub();
    expect(result).toBe(conn);
  });

  it("stops the connection on disconnect", async () => {
    await mod.connectNotificationHub();
    state.current = "Connected";
    await mod.disconnectNotificationHub();
    expect(conn.stop).toHaveBeenCalled();
    expect(mod.getNotificationHubConnection()).toBeNull();
  });

  it("disconnect is a no-op when there is no connection", async () => {
    await expect(mod.disconnectNotificationHub()).resolves.toBeUndefined();
  });
});
