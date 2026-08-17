import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/hooks/use-toast";
import LiveDeploymentLogs from "./live-logs-section";

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

const dispatchNotification = (payload: Record<string, unknown>) => {
  act(() => {
    window.dispatchEvent(
      new CustomEvent("BuildLogNotification", {
        detail: {
          message: { denormalizedPayload: JSON.stringify({ Message: payload }) },
        },
      }),
    );
  });
};

const startedEvent = {
  buildId: "b1",
  eventType: "EventStarted",
  eventGroup: "Build",
  message: "starting",
  createdAt: "2024-01-01T00:00:00Z",
};

const logEvent = {
  buildId: "b1",
  eventType: "Log",
  eventGroup: "Build",
  message: "line one\nline two",
  createdAt: "2024-01-01T00:00:30Z",
};

describe("LiveDeploymentLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the waiting state with no build id", () => {
    render(<LiveDeploymentLogs />);
    expect(screen.getByText("Waiting for build ID...")).toBeInTheDocument();
  });

  it("renders historical build steps and toggles a step open", () => {
    render(
      <LiveDeploymentLogs
        buildId="b1"
        historicalEvents={
          [
            {
              buildId: "b1",
              eventType: "EventStarted",
              eventGroup: "Build",
              message: "starting",
              createdAt: "2024-01-01T00:00:00Z",
            },
            {
              buildId: "b1",
              eventType: "Log",
              eventGroup: "Build",
              message: "line one\nline two",
              createdAt: "2024-01-01T00:00:30Z",
            },
          ] as never
        }
      />,
    );
    const step = screen.getByText("Build");
    // The step has logs, so clicking expands and reveals the log lines.
    fireEvent.click(step);
    expect(screen.getByText("line one")).toBeInTheDocument();
    // Clicking again collapses.
    fireEvent.click(step);
  });

  it("shows a success toast on a finished deploy notification", () => {
    render(<LiveDeploymentLogs buildId="b1" historicalEvents={[] as never} />);
    dispatchNotification({
      BuildId: "b1",
      EventGroup: "Deploy",
      EventType: "EventFinished",
      Message: "done",
    });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("shows an error toast on a failed deploy notification", () => {
    render(<LiveDeploymentLogs buildId="b1" historicalEvents={[] as never} />);
    dispatchNotification({
      BuildId: "b1",
      EventGroup: "Deploy",
      EventType: "EventFailed",
      Message: "boom",
    });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "destructive" }),
    );
  });

  it("expands a step when a log notification arrives", () => {
    render(
      <LiveDeploymentLogs
        buildId="b1"
        historicalEvents={
          [
            {
              buildId: "b1",
              eventType: "EventStarted",
              eventGroup: "Build",
              message: "starting",
              createdAt: "2024-01-01T00:00:00Z",
            },
          ] as never
        }
      />,
    );
    dispatchNotification({
      BuildId: "b1",
      EventGroup: "Build",
      EventType: "Log",
      Message: "compiling output",
    });
    expect(screen.getByText("Build")).toBeInTheDocument();
  });

  it("connects after the connection timer elapses", () => {
    vi.useFakeTimers();
    render(<LiveDeploymentLogs buildId="b1" historicalEvents={[] as never} />);
    vi.advanceTimersByTime(3100);
    vi.useRealTimers();
    expect(screen.getByText("Deployment logs")).toBeInTheDocument();
  });

  it("ignores notifications for a different build id", () => {
    render(<LiveDeploymentLogs buildId="b1" historicalEvents={[] as never} />);
    dispatchNotification({
      BuildId: "other",
      EventGroup: "Deploy",
      EventType: "EventFinished",
      Message: "done",
    });
    expect(toast).not.toHaveBeenCalled();
  });

  it("toggles a step open and closed with Enter", () => {
    render(
      <LiveDeploymentLogs
        buildId="b1"
        historicalEvents={[startedEvent, logEvent] as never}
      />,
    );
    const header = screen.getByRole("button", { name: /Build/ });
    fireEvent.keyDown(header, { key: "Enter" });
    expect(screen.getByText("line one")).toBeInTheDocument();
    fireEvent.keyDown(header, { key: "Enter" });
    expect(screen.queryByText("line one")).not.toBeInTheDocument();
  });

  it("toggles a step open with Space and stops the page scrolling", () => {
    render(
      <LiveDeploymentLogs
        buildId="b1"
        historicalEvents={[startedEvent, logEvent] as never}
      />,
    );
    const header = screen.getByRole("button", { name: /Build/ });
    const space = createEvent.keyDown(header, { key: " " });
    fireEvent(header, space);
    expect(space.defaultPrevented).toBe(true);
    expect(screen.getByText("line one")).toBeInTheDocument();
  });

  it("ignores keys other than Enter and Space on a step header", () => {
    render(
      <LiveDeploymentLogs
        buildId="b1"
        historicalEvents={[startedEvent, logEvent] as never}
      />,
    );
    const header = screen.getByRole("button", { name: /Build/ });
    const escape = createEvent.keyDown(header, { key: "Escape" });
    fireEvent(header, escape);
    expect(escape.defaultPrevented).toBe(false);
    expect(screen.queryByText("line one")).not.toBeInTheDocument();
  });

  it("leaves a step without logs inert when Enter is pressed", () => {
    // No Log event, so the Build step has no logs and must not toggle.
    const { container } = render(
      <LiveDeploymentLogs
        buildId="b1"
        historicalEvents={[startedEvent] as never}
      />,
    );
    const header = screen.getByRole("button", { name: /Build/ });
    const before = container.innerHTML;
    fireEvent.keyDown(header, { key: "Enter" });
    expect(container.innerHTML).toBe(before);
  });
});

// ─── per-step timings (issue #155) ───────────────────────────────────────────

const k8sLine = (iso: string, text = "working") => `${iso} ${text}`;

describe("LiveDeploymentLogs step timings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the real log-derived duration for a historical build", () => {
    render(
      <LiveDeploymentLogs
        buildId="b1"
        historicalEvents={
          [
            {
              buildId: "b1",
              eventType: "EventStarted",
              eventGroup: "Clone",
              message: "",
              createdAt: "2026-08-04T10:27:13Z",
            },
            {
              buildId: "b1",
              eventType: "Log",
              eventGroup: "Clone",
              message: `${k8sLine("2026-08-04T10:27:17.552157025Z", "cloning")}\n${k8sLine("2026-08-04T10:27:18.714271836Z", "cloned")}`,
              createdAt: "2026-08-04T10:27:18Z",
            },
            {
              buildId: "b1",
              eventType: "EventFinished",
              eventGroup: "Clone",
              message: "",
              createdAt: "2026-08-04T10:27:20Z",
            },
          ] as never
        }
      />,
    );

    // The historical payloads arrive PascalCased; without normalisation the
    // shared resolver would match nothing and this would silently read "--".
    expect(screen.getByText("1.2s")).toBeInTheDocument();
    expect(screen.queryByText("7s")).not.toBeInTheDocument();
  });

  it("shows a placeholder and omits the meta bar when nothing resolves", () => {
    render(
      <LiveDeploymentLogs
        buildId="b1"
        historicalEvents={
          [
            {
              buildId: "b1",
              eventType: "Log",
              eventGroup: "Sca",
              message: "scanning with no timestamp",
              createdAt: "",
            },
          ] as never
        }
      />,
    );

    expect(screen.getByText("--")).toBeInTheDocument();

    // Expanding an unresolved step shows its log lines and nothing else - not an
    // empty bar, not a bar of dashes.
    // The live view renders the group name as-is; only the deployed view
    // uppercases the SAST/SCA labels.
    fireEvent.click(screen.getByText("Sca"));
    expect(screen.getByText("scanning with no timestamp")).toBeInTheDocument();
    expect(screen.queryByText(/^Started/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Took/)).not.toBeInTheDocument();
  });

  it("shows when a step ran once it is expanded, and omits the bar when it cannot", () => {
    render(
      <LiveDeploymentLogs
        buildId="b1"
        historicalEvents={
          [
            {
              buildId: "b1",
              eventType: "Log",
              eventGroup: "Build",
              message: `${k8sLine("2026-08-04T10:29:35.480Z", "compiling")}\n${k8sLine("2026-08-04T10:29:41.880Z", "linked")}`,
              createdAt: "2026-08-04T10:29:42Z",
            },
          ] as never
        }
      />,
    );

    fireEvent.click(screen.getByText("Build"));
    expect(screen.getByText("Took 6.4s")).toBeInTheDocument();
    expect(screen.getByText(/^Started \d{2}:\d{2}:\d{2}\.\d{3}$/)).toBeInTheDocument();
    // The RFC3339 prefix keeps rendering inline in the log body.
    expect(screen.getByText(/^2026-08-04T10:29:35\.480Z compiling$/)).toBeInTheDocument();
  });

  it("grows a running step's elapsed time as further log lines arrive", () => {
    render(<LiveDeploymentLogs buildId="b1" />);

    dispatchNotification({
      BuildId: "b1",
      EventType: "Log",
      EventGroup: "Build",
      Message: k8sLine("2026-08-04T10:29:35.480Z", "compiling"),
      CreatedAt: "2026-08-04T10:29:36Z",
    });

    dispatchNotification({
      BuildId: "b1",
      EventType: "Log",
      EventGroup: "Build",
      Message: k8sLine("2026-08-04T10:29:41.880Z", "still compiling"),
      CreatedAt: "2026-08-04T10:29:42Z",
    });

    // Computed from the newest log timestamp, never from the wall clock.
    expect(screen.getByText("6.4s")).toBeInTheDocument();
  });
});
