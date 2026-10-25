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
    const { container } = render(
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
    // The RFC3339 prefix keeps rendering inline in the log body - now in its own
    // dimmed span, so it is read off the container rather than as one text node.
    expect(container.textContent).toContain("2026-08-04T10:29:35.480Z compiling");
    expect(screen.getByText("2026-08-04T10:29:35.480Z")).toHaveClass(
      "text-low-emphasis",
    );
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

  it("says a running step is running instead of claiming it ended", () => {
    render(<LiveDeploymentLogs buildId="b1" />);

    dispatchNotification({
      BuildId: "b1",
      EventType: "Log",
      EventGroup: "Build",
      Message: `${k8sLine("2026-08-04T10:29:35.480Z", "compiling")}\n${k8sLine("2026-08-04T10:29:41.880Z", "still compiling")}`,
      CreatedAt: "2026-08-04T10:29:42Z",
    });

    // A log notification auto-expands its step, so the bar is already on screen.
    // The newest log line is only how far it has got, not when it finished.
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Elapsed 6.4s")).toBeInTheDocument();
    expect(screen.queryByText(/^Ended/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Took/)).not.toBeInTheDocument();
    // It still says when it started - that part is known.
    expect(screen.getByText(/^Started \d{2}:\d{2}:\d{2}\.\d{3}$/)).toBeInTheDocument();
  });

  it("switches to Ended and Took once the step finishes", () => {
    render(<LiveDeploymentLogs buildId="b1" />);

    dispatchNotification({
      BuildId: "b1",
      EventType: "Log",
      EventGroup: "Build",
      Message: `${k8sLine("2026-08-04T10:29:35.480Z", "compiling")}\n${k8sLine("2026-08-04T10:29:41.880Z", "linked")}`,
      CreatedAt: "2026-08-04T10:29:42Z",
    });
    dispatchNotification({
      BuildId: "b1",
      EventType: "EventFinished",
      EventGroup: "Build",
      Message: "",
      CreatedAt: "2026-08-04T10:29:45Z",
    });

    expect(screen.getByText(/^Ended /)).toBeInTheDocument();
    expect(screen.getByText("Took 6.4s")).toBeInTheDocument();
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Elapsed/)).not.toBeInTheDocument();
  });
});

// ─── expanded-step stability (issue #236) ────────────────────────────────────

const foreignLog = (EventGroup = "Clone", Message = "x") => ({
  BuildId: "b2",
  EventGroup,
  EventType: "Log",
  Message,
  CreatedAt: "2024-01-01T00:01:00Z",
});

const renderWithBuildExpanded = () => {
  const utils = render(
    <LiveDeploymentLogs
      buildId="b1"
      historicalEvents={[startedEvent, logEvent] as never}
    />,
  );
  fireEvent.click(screen.getByText("Build"));
  expect(screen.getByText("line one")).toBeInTheDocument();
  return utils;
};

const stepNames = () =>
  screen.getAllByRole("button").map((header) => header.textContent);

const chevron = (header: HTMLElement) =>
  header.querySelector(".lucide-chevron-down")
    ? "down"
    : header.querySelector(".lucide-chevron-right")
      ? "right"
      : "none";

describe("LiveDeploymentLogs expanded-step stability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps an expanded step open when another build's log arrives", () => {
    renderWithBuildExpanded();
    dispatchNotification(foreignLog());
    expect(screen.getByText("line one")).toBeInTheDocument();
    expect(screen.getByText("line two")).toBeInTheDocument();
    expect(chevron(screen.getByRole("button", { name: /Build/ }))).toBe("down");
    expect(screen.queryByText("Clone")).not.toBeInTheDocument();
  });

  it.each(["EventStarted", "EventFinished", "EventFailed"])(
    "keeps an expanded step open when another build's %s arrives",
    (EventType) => {
      renderWithBuildExpanded();
      dispatchNotification({
        BuildId: "b2",
        EventGroup: "Build",
        EventType,
        Message: "",
        CreatedAt: "2024-01-01T00:01:00Z",
      });
      expect(screen.getByText("line one")).toBeInTheDocument();
      expect(chevron(screen.getByRole("button", { name: /Build/ }))).toBe(
        "down",
      );
    },
  );

  it("shows no toast and adds no step for another build's deploy events", () => {
    renderWithBuildExpanded();
    dispatchNotification({
      BuildId: "b2",
      EventGroup: "Deploy",
      EventType: "EventFinished",
      Message: "done",
    });
    dispatchNotification({
      BuildId: "b2",
      EventGroup: "Deploy",
      EventType: "EventFailed",
      Message: "boom",
    });
    expect(toast).not.toHaveBeenCalled();
    expect(stepNames()).toEqual([expect.stringContaining("Build")]);
    expect(screen.getByText("line one")).toBeInTheDocument();
  });

  it("leaves a mix of open and closed steps as the user left them", () => {
    render(
      <LiveDeploymentLogs
        buildId="b1"
        historicalEvents={
          [
            { ...startedEvent, eventGroup: "Clone" },
            { ...logEvent, eventGroup: "Clone", message: "clone line" },
            startedEvent,
            logEvent,
          ] as never
        }
      />,
    );
    fireEvent.click(screen.getByText("Clone"));
    expect(screen.getByText("clone line")).toBeInTheDocument();

    dispatchNotification(foreignLog("Clone"));
    dispatchNotification(foreignLog("Build"));

    expect(chevron(screen.getByRole("button", { name: /Clone/ }))).toBe("down");
    expect(screen.getByText("clone line")).toBeInTheDocument();
    expect(chevron(screen.getByRole("button", { name: /Build/ }))).toBe(
      "right",
    );
    expect(screen.queryByText("line one")).not.toBeInTheDocument();
  });

  it("keeps a user-collapsed step collapsed after another build's log", () => {
    renderWithBuildExpanded();
    fireEvent.click(screen.getByText("Build"));
    dispatchNotification(foreignLog("Build"));
    expect(chevron(screen.getByRole("button", { name: /Build/ }))).toBe(
      "right",
    );
    expect(screen.queryByText("line one")).not.toBeInTheDocument();
  });

  it("keeps a user-collapsed step collapsed when its own build logs more", () => {
    renderWithBuildExpanded();
    fireEvent.click(screen.getByText("Build"));
    dispatchNotification({
      BuildId: "b1",
      EventGroup: "Build",
      EventType: "Log",
      Message: "line three",
      CreatedAt: "2024-01-01T00:00:40Z",
    });
    expect(chevron(screen.getByRole("button", { name: /Build/ }))).toBe(
      "right",
    );
    expect(screen.queryByText("line three")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Build"));
    expect(screen.getByText("line three")).toBeInTheDocument();
  });

  it("keeps an expanded step open when its own build logs more", () => {
    renderWithBuildExpanded();
    dispatchNotification({
      BuildId: "b1",
      EventGroup: "Build",
      EventType: "Log",
      // A payload carries the step's whole log, replacing its lines.
      Message: "line one\nline two\nline three",
      CreatedAt: "2024-01-01T00:00:40Z",
    });
    expect(chevron(screen.getByRole("button", { name: /Build/ }))).toBe("down");
    expect(screen.getByText("line one")).toBeInTheDocument();
    expect(screen.getByText("line three")).toBeInTheDocument();
  });

  it("auto-expands a new step of the current build while another stays open", () => {
    renderWithBuildExpanded();
    dispatchNotification(foreignLog("Deploy", "other deploying"));
    dispatchNotification({
      BuildId: "b1",
      EventGroup: "Deploy",
      EventType: "Log",
      Message: "deploying",
      CreatedAt: "2024-01-01T00:00:50Z",
    });
    expect(chevron(screen.getByRole("button", { name: /Deploy/ }))).toBe(
      "down",
    );
    expect(screen.getByText("deploying")).toBeInTheDocument();
    expect(screen.queryByText("other deploying")).not.toBeInTheDocument();
    expect(chevron(screen.getByRole("button", { name: /Build/ }))).toBe("down");
    expect(screen.getByText("line one")).toBeInTheDocument();
  });

  it("toggles a step normally after another build's messages", () => {
    renderWithBuildExpanded();
    dispatchNotification(foreignLog());
    fireEvent.click(screen.getByText("Build"));
    expect(screen.queryByText("line one")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Build"));
    expect(screen.getByText("line one")).toBeInTheDocument();
  });

  it("changes no step content and adds no line from another build", () => {
    const { container } = renderWithBuildExpanded();
    const before = container.innerHTML;
    dispatchNotification(foreignLog("Build", "foreign line"));
    dispatchNotification(foreignLog("Clone", "foreign clone"));
    expect(container.innerHTML).toBe(before);
    expect(screen.queryByText("foreign line")).not.toBeInTheDocument();
    expect(screen.getByText("01").nextSibling).toHaveTextContent("line one");
    expect(screen.getByText("02").nextSibling).toHaveTextContent("line two");
  });

  it("is unchanged after a burst of 200 messages from another build", () => {
    const { container } = renderWithBuildExpanded();
    const before = container.innerHTML;
    for (let i = 0; i < 200; i++) {
      dispatchNotification(foreignLog("Build", "n"));
    }
    expect(container.innerHTML).toBe(before);
    expect(stepNames()).toEqual([expect.stringContaining("Build")]);
    expect(screen.queryByText("n")).not.toBeInTheDocument();
  });

  it("keeps steps open when a notification cannot be parsed", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      const { container } = renderWithBuildExpanded();
      const before = container.innerHTML;
      act(() => {
        window.dispatchEvent(
          new CustomEvent("BuildLogNotification", {
            detail: { message: { denormalizedPayload: "not json" } },
          }),
        );
      });
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to parse notification data:",
        expect.anything(),
      );
      expect(container.innerHTML).toBe(before);
      fireEvent.click(screen.getByText("Build"));
      expect(screen.queryByText("line one")).not.toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("shows only the new build's steps, none expanded, after the route changes", () => {
    const { rerender, container } = renderWithBuildExpanded();
    rerender(
      <LiveDeploymentLogs
        buildId="b2"
        historicalEvents={
          [
            { ...startedEvent, buildId: "b2" },
            { ...logEvent, buildId: "b2", message: "b2 line" },
          ] as never
        }
      />,
    );
    expect(screen.queryByText("line one")).not.toBeInTheDocument();
    expect(screen.queryByText("b2 line")).not.toBeInTheDocument();
    expect(stepNames()).toEqual([expect.stringContaining("Build")]);
    expect(container.querySelector(".lucide-chevron-down")).toBeNull();
    fireEvent.click(screen.getByText("Build"));
    expect(screen.getByText("b2 line")).toBeInTheDocument();
  });

  it("keeps keyboard focus on a step header when another build's log arrives", () => {
    renderWithBuildExpanded();
    const header = screen.getByRole("button", { name: /Build/ });
    header.focus();
    dispatchNotification(foreignLog());
    expect(screen.getByRole("button", { name: /Build/ })).toBe(header);
    expect(header).toHaveFocus();
    fireEvent.keyDown(header, { key: "Enter" });
    expect(screen.queryByText("line one")).not.toBeInTheDocument();
  });

  it("leaves a running step's duration and timing bar unchanged", () => {
    render(<LiveDeploymentLogs buildId="b1" />);
    dispatchNotification({
      BuildId: "b1",
      EventType: "Log",
      EventGroup: "Build",
      Message: `${k8sLine("2026-08-04T10:29:35.480Z", "compiling")}\n${k8sLine("2026-08-04T10:29:41.880Z", "still compiling")}`,
      CreatedAt: "2026-08-04T10:29:42Z",
    });
    expect(screen.getByText("6.4s")).toBeInTheDocument();
    expect(screen.getByText("Elapsed 6.4s")).toBeInTheDocument();

    dispatchNotification({
      BuildId: "b2",
      EventType: "Log",
      EventGroup: "Build",
      Message: k8sLine("2026-08-04T10:31:00.000Z", "other build"),
      CreatedAt: "2026-08-04T10:31:01Z",
    });

    expect(screen.getByText("6.4s")).toBeInTheDocument();
    expect(screen.getByText("Elapsed 6.4s")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
  });
});
