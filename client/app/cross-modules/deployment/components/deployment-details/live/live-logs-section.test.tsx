import { act, fireEvent, render, screen } from "@testing-library/react";
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
});
