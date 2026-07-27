import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DeployedLogs from "./deployed-logs";

const cardData = {
  status: "Completed",
  eventName: "deploy",
  events: [
    {
      buildId: "b1",
      eventGroup: "Build",
      eventType: "EventStarted",
      message: "starting",
      createdAt: "2024-01-01T00:00:00Z",
    },
    {
      buildId: "b1",
      eventGroup: "Build",
      eventType: "Log",
      message: "compiling\nlinking",
      createdAt: "2024-01-01T00:00:30Z",
    },
    {
      buildId: "b1",
      eventGroup: "Build",
      eventType: "EventFinished",
      message: "done",
      createdAt: "2024-01-01T00:01:00Z",
    },
  ],
} as never;

describe("DeployedLogs", () => {
  it("renders the loading state", () => {
    render(<DeployedLogs buildId="b1" isLoading />);
    expect(screen.getByText("Loading deployment logs...")).toBeInTheDocument();
  });

  it("renders the waiting state without a build id", () => {
    render(<DeployedLogs isSuccess cardData={cardData} />);
    expect(screen.getByText("Waiting for build ID...")).toBeInTheDocument();
  });

  it("renders processed steps and toggles a step open", () => {
    render(<DeployedLogs buildId="b1" isSuccess cardData={cardData} />);
    const step = screen.getByText("Build");
    fireEvent.click(step);
    expect(screen.getByText("compiling")).toBeInTheDocument();
    fireEvent.click(step);
  });

  it("renders the error state", () => {
    render(<DeployedLogs buildId="b1" isError />);
    expect(
      screen.getByText("Failed to load deployment data"),
    ).toBeInTheDocument();
  });
});
