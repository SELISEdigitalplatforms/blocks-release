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

// â”€â”€â”€ per-step timings (issue #155) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const k8s = (iso: string, text = "working") => `${iso} ${text}`;

/** The status line as the reader sees it, from both the desktop and mobile header. */
const statusLines = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("p"))
    .map((p) => p.textContent?.replace(/\s+/g, " ").trim() ?? "")
    .filter((text) => text.startsWith("Successful at "));

// Shaped like a real GET /api/build?buildId= response: nine-digit k8s fractions
// on the log lines, poller stamps several seconds wider on the markers. Clone
// really took 1.162s; the poller would have called it 7s.
const timedCardData = {
  status: "Completed",
  eventName: "push",
  events: [
    {
      buildId: "b1",
      eventGroup: "Clone",
      eventType: "EventStarted",
      message: "",
      createdAt: "2026-08-04T10:27:13Z",
    },
    {
      buildId: "b1",
      eventGroup: "Clone",
      eventType: "Log",
      message: `${k8s("2026-08-04T10:27:17.552157025Z", "cloning")}\n${k8s("2026-08-04T10:27:18.714271836Z", "cloned")}`,
      createdAt: "2026-08-04T10:27:18Z",
    },
    {
      buildId: "b1",
      eventGroup: "Clone",
      eventType: "EventFinished",
      message: "",
      createdAt: "2026-08-04T10:27:20Z",
    },
  ],
} as never;

// No k8s prefixes anywhere, so this build can only fall back to poller stamps.
const pollerOnlyCardData = {
  status: "Completed",
  eventName: "push",
  events: [
    {
      buildId: "b1",
      eventGroup: "Build",
      eventType: "EventStarted",
      message: "",
      createdAt: "2026-08-04T15:14:03Z",
    },
    {
      buildId: "b1",
      eventGroup: "Build",
      eventType: "Log",
      message: "compiling without a timestamp",
      createdAt: "2026-08-04T15:14:20Z",
    },
    {
      buildId: "b1",
      eventGroup: "Build",
      eventType: "EventFinished",
      message: "",
      createdAt: "2026-08-04T15:14:48Z",
    },
  ],
} as never;

// Neither a parseable log timestamp nor a start/end pair.
const untimedCardData = {
  status: "Completed",
  eventName: "push",
  events: [
    {
      buildId: "b1",
      eventGroup: "Sca",
      eventType: "Log",
      message: "scanning with no timestamp",
      createdAt: "2026-08-04T10:00:00Z",
    },
  ],
} as never;

describe("DeployedLogs step timings", () => {
  it("shows the real log-derived duration, not the poller's", () => {
    render(<DeployedLogs buildId="b1" isSuccess cardData={timedCardData} />);
    expect(screen.getByText("1.2s")).toBeInTheDocument();
    expect(screen.queryByText("7s")).not.toBeInTheDocument();
  });

  it("shows when the step ran once it is expanded", () => {
    render(<DeployedLogs buildId="b1" isSuccess cardData={timedCardData} />);
    // Clone auto-expands, so the meta bar is already on screen.
    expect(screen.getByText(/^Started /)).toBeInTheDocument();
    expect(screen.getByText(/^Ended /)).toBeInTheDocument();
    expect(screen.getByText("Took 1.2s")).toBeInTheDocument();
    // Millisecond precision is kept for a log-derived range.
    expect(screen.getByText(/^Started \d{2}:\d{2}:\d{2}\.\d{3}$/)).toBeInTheDocument();
  });

  it("offers the full start and end on the chip tooltip", () => {
    render(<DeployedLogs buildId="b1" isSuccess cardData={timedCardData} />);
    const title = screen.getByText("1.2s").getAttribute("title") ?? "";
    expect(title).toContain("Started ");
    expect(title).toContain("Ended ");
    expect(title).toContain("Took 1.2s");
    // A measured value must not be hedged as approximate.
    expect(title).not.toContain("Approximate");
  });

  it("totals the pipeline in both the desktop and the mobile header", () => {
    const { container } = render(
      <DeployedLogs buildId="b1" isSuccess cardData={timedCardData} />,
    );
    // The status line is assembled from several text nodes, so read the
    // paragraphs directly rather than trying to match one node.
    const headers = statusLines(container);
    expect(headers).toHaveLength(2);
    headers.forEach((text) => expect(text).toBe("Successful at push · 1.2s"));
  });

  it("marks a poller-derived duration approximate and drops the millis", () => {
    render(<DeployedLogs buildId="b1" isSuccess cardData={pollerOnlyCardData} />);
    const chip = screen.getByText("~45s");
    expect(chip).toBeInTheDocument();
    expect(chip.getAttribute("title")).toContain("Approximate");

    fireEvent.click(screen.getByText("Build"));
    expect(screen.getByText(/^Started ~\d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it("leaves the total out when no step is log-derived", () => {
    const { container } = render(
      <DeployedLogs buildId="b1" isSuccess cardData={pollerOnlyCardData} />,
    );
    const headers = statusLines(container);
    expect(headers).toHaveLength(2);
    headers.forEach((text) => expect(text).toBe("Successful at push"));
  });

  it("shows a placeholder and no meta bar when nothing can be resolved", () => {
    render(<DeployedLogs buildId="b1" isSuccess cardData={untimedCardData} />);
    expect(screen.getByText("--")).toBeInTheDocument();

    fireEvent.click(screen.getByText("SCA"));
    expect(screen.getByText("scanning with no timestamp")).toBeInTheDocument();
    expect(screen.queryByText(/^Started/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Took/)).not.toBeInTheDocument();
  });

  it("says a running step is running rather than giving it an end time", () => {
    // EventStarted with logs but no terminal marker: the step is still in flight.
    const running = {
      status: "Running",
      eventName: "push",
      events: [
        {
          buildId: "b1",
          eventGroup: "Build",
          eventType: "EventStarted",
          message: "",
          createdAt: "2026-08-04T10:29:30Z",
        },
        {
          buildId: "b1",
          eventGroup: "Build",
          eventType: "Log",
          message: `${k8s("2026-08-04T10:29:35.480Z", "compiling")}\n${k8s("2026-08-04T10:29:41.880Z", "still compiling")}`,
          createdAt: "2026-08-04T10:29:42Z",
        },
      ],
    } as never;

    render(<DeployedLogs buildId="b1" isSuccess cardData={running} />);
    fireEvent.click(screen.getByText("Build"));

    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Elapsed 6.4s")).toBeInTheDocument();
    expect(screen.queryByText(/^Ended/)).not.toBeInTheDocument();
    // The chip tooltip must not hedge it as finished either.
    const title = screen.getByText("6.4s").getAttribute("title") ?? "";
    expect(title).toContain("Last output ");
    expect(title).not.toContain("Ended");
  });

  it("still times a failed step and leaves it expanded", () => {
    const failed = {
      status: "Failed",
      eventName: "push",
      events: [
        {
          buildId: "b1",
          eventGroup: "Deploy",
          eventType: "Log",
          message: `${k8s("2026-08-04T10:29:02.109Z", "deploying")}\n${k8s("2026-08-04T10:31:34.201Z", "failed")}`,
          createdAt: "2026-08-04T10:31:00Z",
        },
        {
          buildId: "b1",
          eventGroup: "Deploy",
          eventType: "EventFailed",
          message: "",
          createdAt: "2026-08-04T10:31:40Z",
        },
      ],
    } as never;

    render(<DeployedLogs buildId="b1" isSuccess cardData={failed} />);
    expect(screen.getByText("2m 32s")).toBeInTheDocument();
    // Auto-expanded because it failed, so its log body is already visible.
    expect(screen.getByText(/deploying$/)).toBeInTheDocument();
  });

  it("leaves the log body, gutter and labels untouched", () => {
    const { container } = render(
      <DeployedLogs buildId="b1" isSuccess cardData={timedCardData} />,
    );
    // The RFC3339 prefix keeps rendering inline, in place. It now sits in its own
    // dimmed span, so the line is split across elements and has to be read off the
    // container rather than matched as one text node.
    expect(container.textContent).toContain(
      "2026-08-04T10:27:17.552157025Z cloning",
    );
    expect(screen.getByText("2026-08-04T10:27:17.552157025Z")).toHaveClass(
      "text-low-emphasis",
    );
    expect(container.textContent).toContain("01");
  });
});


