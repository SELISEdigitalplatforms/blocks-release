import { createEvent, fireEvent, render, screen } from "@testing-library/react";
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

// The same build with no Log events, so the Build step has no logs and stays
// inert: shouldShowChevron() is false and the header must not toggle.
const inertCardData = {
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

  it("toggles a step open and closed with Enter", () => {
    render(<DeployedLogs buildId="b1" isSuccess cardData={cardData} />);
    const header = screen.getByRole("button", { name: /Build/ });
    fireEvent.keyDown(header, { key: "Enter" });
    expect(screen.getByText("compiling")).toBeInTheDocument();
    fireEvent.keyDown(header, { key: "Enter" });
    expect(screen.queryByText("compiling")).not.toBeInTheDocument();
  });

  it("toggles a step open with Space and stops the page scrolling", () => {
    render(<DeployedLogs buildId="b1" isSuccess cardData={cardData} />);
    const header = screen.getByRole("button", { name: /Build/ });
    const space = createEvent.keyDown(header, { key: " " });
    fireEvent(header, space);
    expect(space.defaultPrevented).toBe(true);
    expect(screen.getByText("compiling")).toBeInTheDocument();
  });

  it("ignores keys other than Enter and Space on a step header", () => {
    render(<DeployedLogs buildId="b1" isSuccess cardData={cardData} />);
    const header = screen.getByRole("button", { name: /Build/ });
    const escape = createEvent.keyDown(header, { key: "Escape" });
    fireEvent(header, escape);
    expect(escape.defaultPrevented).toBe(false);
    expect(screen.queryByText("compiling")).not.toBeInTheDocument();
  });

  it("leaves a step without logs inert when Enter is pressed", () => {
    const { container } = render(
      <DeployedLogs buildId="b1" isSuccess cardData={inertCardData} />,
    );
    const header = screen.getByRole("button", { name: /Build/ });
    const before = container.innerHTML;
    fireEvent.keyDown(header, { key: "Enter" });
    expect(container.innerHTML).toBe(before);
  });
});
