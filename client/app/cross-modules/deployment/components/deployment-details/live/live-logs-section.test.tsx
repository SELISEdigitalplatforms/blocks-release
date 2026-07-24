import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LiveDeploymentLogs from "./live-logs-section";

describe("LiveDeploymentLogs", () => {
  it("renders with no build id", () => {
    const { container } = render(<LiveDeploymentLogs />);
    expect(container).toBeTruthy();
  });

  it("renders with a build id and historical events", () => {
    const { container } = render(
      <LiveDeploymentLogs
        buildId="b1"
        historicalEvents={
          [
            {
              eventType: "EventStarted",
              eventGroup: "Build",
              message: "starting",
              createdAt: "2024-01-01T00:00:00Z",
            },
            {
              eventType: "EventFinished",
              eventGroup: "Build",
              message: "done",
              createdAt: "2024-01-01T00:01:00Z",
            },
          ] as never
        }
      />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});
