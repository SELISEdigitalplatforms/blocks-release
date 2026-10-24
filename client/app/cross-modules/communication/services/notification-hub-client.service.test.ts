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

const getNotifications = vi.fn();
const withUrl = vi.fn();
vi.mock("./notification.service", () => ({
  notificationService: { getNotifications },
}));

vi.mock("@microsoft/signalr", () => {
  class HubConnectionBuilder {
    withUrl(...args: unknown[]) {
      withUrl(...args);
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

type MutableWindow = typeof globalThis.window & { __BLOCKS_ENV__?: Record<string, string> };

describe("notification-hub-client.service", () => {
  let mod: typeof import("./notification-hub-client.service");
  // Every loaded copy is disconnected after each test, so no window listener leaks into the next one.
  const loaded: (typeof mod)[] = [];

  beforeEach(async () => {
    vi.clearAllMocks();
    state.current = "Disconnected";
    conn.start.mockResolvedValue(undefined);
    conn.stop.mockResolvedValue(undefined);
    (globalThis.window as MutableWindow).__BLOCKS_ENV__ = {
      BLOCKS_LOGIC_BASE_URL: "https://dev-logic.blocksdevelopers.com",
      BLOCKS_X_BLOCKS_KEY: "key-123",
    };
    vi.resetModules();
    mod = await import("./notification-hub-client.service");
    loaded.push(mod);
  });

  afterEach(async () => {
    await Promise.all(loaded.splice(0).map((m) => m.disconnectNotificationHub()));
    (globalThis.window as MutableWindow).__BLOCKS_ENV__ = {
      BLOCKS_LOGIC_BASE_URL: "https://dev-logic.blocksdevelopers.com",
    };
  });

  it("opens the socket in one request, without negotiate", async () => {
    await mod.connectNotificationHub();
    expect(withUrl).toHaveBeenCalledWith(
      expect.stringContaining("x-blocks-key=key-123"),
      expect.objectContaining({ transport: 1, skipNegotiation: true }),
    );
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
    (globalThis.window as MutableWindow).__BLOCKS_ENV__ = { BLOCKS_LOGIC_BASE_URL: "" };
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

  describe("reconnect after the connection closes", () => {
    const refused = () => Object.assign(new Error("Session expired"), { status: 401 });
    const closeConnection = () => {
      state.current = "Disconnected";
      const onClose = conn.onclose.mock.calls.at(-1)?.[0] as (err?: Error) => void;
      onClose();
    };
    const connectAndClear = async () => {
      await mod.connectNotificationHub();
      state.current = "Connected";
      conn.start.mockClear();
      getNotifications.mockClear();
    };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.spyOn(console, "log").mockImplementation(() => {});
      getNotifications.mockResolvedValue({});
      conn.start.mockImplementation(async () => {
        state.current = "Connected";
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("refreshes the login and starts again when the connection closes", async () => {
      await connectAndClear();

      closeConnection();
      await vi.advanceTimersByTimeAsync(0);

      expect(getNotifications).toHaveBeenCalledTimes(1);
      expect(conn.start).toHaveBeenCalledTimes(1);
      expect(mod.getNotificationHubConnection()).toBe(conn);
    });

    it("retries with backoff while the start fails", async () => {
      await connectAndClear();
      conn.start.mockRejectedValue(new Error("network"));

      closeConnection();
      await vi.advanceTimersByTimeAsync(0);
      expect(conn.start).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1999);
      expect(conn.start).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(conn.start).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(5000);
      expect(conn.start).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(15_000 + 30_000);
      expect(conn.start).toHaveBeenCalledTimes(5);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(conn.start).toHaveBeenCalledTimes(6);
    });

    it("retries with backoff when the first start fails", async () => {
      conn.start.mockRejectedValue(new Error("network"));
      await mod.connectNotificationHub();
      expect(conn.start).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2000);

      expect(getNotifications).toHaveBeenCalledTimes(1);
      expect(conn.start).toHaveBeenCalledTimes(2);
    });

    it("stops retrying quietly when the refresh is refused", async () => {
      await connectAndClear();
      getNotifications.mockRejectedValue(refused());

      closeConnection();
      await vi.advanceTimersByTimeAsync(120_000);

      expect(getNotifications).toHaveBeenCalledTimes(1);
      expect(conn.start).not.toHaveBeenCalled();
    });

    it("still starts when the refresh GET fails with a status other than 401", async () => {
      await connectAndClear();
      getNotifications.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));

      closeConnection();
      await vi.advanceTimersByTimeAsync(0);

      expect(conn.start).toHaveBeenCalledTimes(1);
    });

    it("does not retry after disconnect", async () => {
      await connectAndClear();
      conn.start.mockRejectedValue(new Error("network"));
      closeConnection();
      await vi.advanceTimersByTimeAsync(0);

      await mod.disconnectNotificationHub();
      await vi.advanceTimersByTimeAsync(120_000);

      expect(conn.start).toHaveBeenCalledTimes(1);
    });

    it("does not reconnect when the close follows an intentional disconnect", async () => {
      await connectAndClear();

      await mod.disconnectNotificationHub();
      closeConnection();
      await vi.advanceTimersByTimeAsync(0);

      expect(getNotifications).not.toHaveBeenCalled();
      expect(conn.start).not.toHaveBeenCalled();
    });

    it("never runs two starts in parallel", async () => {
      await connectAndClear();
      let finishStart: () => void = () => {};
      conn.start.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishStart = () => {
              state.current = "Connected";
              resolve();
            };
          }),
      );

      closeConnection();
      await vi.advanceTimersByTimeAsync(0);
      globalThis.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);

      expect(conn.start).toHaveBeenCalledTimes(1);
      finishStart();
      await vi.advanceTimersByTimeAsync(0);
    });

    it("tries at once on the online event while disconnected", async () => {
      await connectAndClear();
      state.current = "Disconnected";

      globalThis.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);

      expect(getNotifications).toHaveBeenCalledTimes(1);
      expect(conn.start).toHaveBeenCalledTimes(1);
    });

    it("tries at once when the tab becomes visible while disconnected", async () => {
      await connectAndClear();
      state.current = "Disconnected";

      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);

      expect(conn.start).toHaveBeenCalledTimes(1);
    });

    it("ignores the online event while connected", async () => {
      await connectAndClear();

      globalThis.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);

      expect(conn.start).not.toHaveBeenCalled();
    });

    it("ignores the online event after disconnect", async () => {
      await connectAndClear();
      await mod.disconnectNotificationHub();
      state.current = "Disconnected";

      globalThis.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(0);

      expect(conn.start).not.toHaveBeenCalled();
    });
  });
});
