import { act, createEvent, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import DeploymentObservability from "./deployment-observability";
import type { IPipeline } from "@blocks-deployment/pages/repo-details";

const navigateMock = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => navigateMock };
});

const builds = [
  {
    itemId: "b1",
    repoId: "r1",
    status: "Succeeded",
    eventName: "deploy",
    createdDate: "2024-01-02T00:00:00Z",
    lastUpdatedDate: "2024-01-02T00:05:00Z",
  },
  {
    itemId: "b2",
    repoId: "r1",
    status: "Failed",
    eventName: "deploy",
    createdDate: "2024-01-01T00:00:00Z",
    lastUpdatedDate: "2024-01-01T00:05:00Z",
  },
] as unknown as IPipeline[];

describe("DeploymentObservability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the latest build view and navigates on row click", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} viewLatestBuild />,
      { route: "/app/deployment/repo/r1" },
    );
    // The latest build is b1; clicking a SAST action navigates to its logs.
    const sast = screen.getAllByText("SAST")[0];
    fireEvent.click(sast);
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("tab=sast"),
    );
  });

  it("renders the full history view and opens a deployment", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} />,
      { route: "/app/deployment/repo/r1" },
    );
    expect(screen.getAllByText(/SAST|SCA|DAST/i).length).toBeGreaterThan(0);
    const scaActions = screen.getAllByText("SCA");
    fireEvent.click(scaActions[0]);
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("tab=sca"),
    );
  });

  it("opens the latest build row with Enter", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} viewLatestBuild />,
      { route: "/app/deployment/repo/r1" },
    );
    const row = screen.getByRole("button", { name: /ID: b1/ });
    fireEvent.keyDown(row, { key: "Enter" });
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("tab=deployment-logs"),
    );
  });

  it("opens the latest build row with Space and stops the page scrolling", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} viewLatestBuild />,
      { route: "/app/deployment/repo/r1" },
    );
    const row = screen.getByRole("button", { name: /ID: b1/ });
    const space = createEvent.keyDown(row, { key: " " });
    fireEvent(row, space);
    expect(space.defaultPrevented).toBe(true);
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("tab=deployment-logs"),
    );
  });

  it("ignores keys other than Enter and Space on the latest build row", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} viewLatestBuild />,
      { route: "/app/deployment/repo/r1" },
    );
    const row = screen.getByRole("button", { name: /ID: b1/ });
    const escape = createEvent.keyDown(row, { key: "Escape" });
    fireEvent(row, escape);
    expect(escape.defaultPrevented).toBe(false);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("does not open the latest build row from a nested action button", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} viewLatestBuild />,
      { route: "/app/deployment/repo/r1" },
    );
    // Enter on the nested SAST button must not also fire the row navigation.
    const row = screen.getByRole("button", { name: /ID: b1/ });
    fireEvent.keyDown(within(row).getByRole("button", { name: /SAST/ }), {
      key: "Enter",
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("opens a history row with Enter and with Space", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} />,
      { route: "/app/deployment/repo/r1" },
    );
    const row = screen.getByRole("button", { name: /ID: b2/ });
    fireEvent.keyDown(row, { key: "Enter" });
    expect(navigateMock).toHaveBeenCalledWith(
      expect.stringContaining("deployment-logs/b2"),
    );
    const space = createEvent.keyDown(row, { key: " " });
    fireEvent(row, space);
    expect(space.defaultPrevented).toBe(true);
    expect(navigateMock).toHaveBeenCalledTimes(2);
  });

  it("renders every build handed in rather than trimming the list", () => {
    renderWithProviders(<DeploymentObservability builds={builds} />, {
      route: "/app/deployment/repo/r1",
    });
    expect(screen.getByRole("button", { name: /ID: b1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ID: b2/ })).toBeInTheDocument();
  });

  it("reports the page's range within the whole history, not within the page", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} startIndex={6} totalCount={28} />,
      { route: "/app/deployment/repo/r1" },
    );
    expect(screen.getByText("Showing 6-7 of 28 deploys")).toBeInTheDocument();
  });

  it("falls back to the builds it was given when no total is supplied", () => {
    renderWithProviders(<DeploymentObservability builds={builds} />, {
      route: "/app/deployment/repo/r1",
    });
    expect(screen.getByText("Showing 1-2 of 2 deploys")).toBeInTheDocument();
  });

  it("reads sensibly on an empty page", () => {
    renderWithProviders(
      <DeploymentObservability builds={[]} startIndex={11} totalCount={28} />,
      { route: "/app/deployment/repo/r1" },
    );
    expect(screen.getByText("Showing 0 of 28 deploys")).toBeInTheDocument();
  });

  it("ignores other keys and nested buttons on a history row", () => {
    renderWithProviders(
      <DeploymentObservability builds={builds} />,
      { route: "/app/deployment/repo/r1" },
    );
    const row = screen.getByRole("button", { name: /ID: b2/ });
    const escape = createEvent.keyDown(row, { key: "Escape" });
    fireEvent(row, escape);
    expect(navigateMock).not.toHaveBeenCalled();

    fireEvent.keyDown(within(row).getByRole("button", { name: /DAST/ }), {
      key: "Enter",
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

// ─── the duration line ───────────────────────────────────────────────────────
//
// This row used to read "Deployed in 16s" over a deployment that was still cloning.
// `lastUpdatedDate` is rewritten on every event the backend records, so mid-run the gap
// between it and `createdDate` is how far the pipeline had got at the last write - not a
// total, and not a deployment. These cover the wording following the status, the number
// advancing while the deployment runs, and the number surviving the moment it lands.

const RUN_START = "2026-09-08T08:09:06.000Z";

/** The build from the bug report: created, one write 16s later, still going. */
const runningBuild = [
  {
    itemId: "live-1",
    repoId: "r1",
    status: "Running",
    eventName: "Clone",
    createdDate: RUN_START,
    lastUpdatedDate: "2026-09-08T08:09:22.000Z",
  },
] as unknown as IPipeline[];

const notifyBuildStatus = (buildId: string, buildStatus: string) => {
  act(() => {
    window.dispatchEvent(
      new CustomEvent("BuildLogNotification", {
        detail: {
          message: {
            denormalizedPayload: JSON.stringify({
              Message: { BuildId: buildId },
              RepoStatus: { BuildStatus: buildStatus },
            }),
          },
        },
      }),
    );
  });
};

describe("DeploymentObservability duration line", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The response landed the instant the last write did, so the row starts out showing
    // exactly what the server measured.
    vi.setSystemTime(new Date("2026-09-08T08:09:22.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const fetchedAt = () => new Date("2026-09-08T08:09:22.000Z").getTime();

  it("counts a running deployment up instead of claiming it deployed", () => {
    renderWithProviders(
      <DeploymentObservability
        builds={runningBuild}
        viewLatestBuild
        dataUpdatedAt={fetchedAt()}
      />,
      { route: "/app/deployment/repo/r1" },
    );

    expect(screen.getByText("Deployment is running · 16s")).toBeInTheDocument();
    expect(screen.queryByText(/Deployed in/)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("Deployment is running · 21s")).toBeInTheDocument();
  });

  // The bug in one assertion: when the deployment finishes, the record in hand is still
  // the stale one that says 16s. Reverting to it would put the wrong number back.
  it("holds the elapsed it reached when the deployment lands, not the stale record's", () => {
    renderWithProviders(
      <DeploymentObservability
        builds={runningBuild}
        viewLatestBuild
        dataUpdatedAt={fetchedAt()}
      />,
      { route: "/app/deployment/repo/r1" },
    );

    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(screen.getByText("Deployment is running · 2m 16s")).toBeInTheDocument();

    notifyBuildStatus("live-1", "Succeeded");

    expect(screen.getByText("Deployed in 2m 16s")).toBeInTheDocument();
    // The exact string from the bug report, which is what the stale record still says.
    expect(screen.queryByText("Deployed in 16s")).not.toBeInTheDocument();

    // And it stops there rather than going on counting.
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText("Deployed in 2m 16s")).toBeInTheDocument();
  });

  it("takes the server's total once a refetch supplies one", () => {
    const { rerender } = renderWithProviders(
      <DeploymentObservability
        builds={runningBuild}
        viewLatestBuild
        dataUpdatedAt={fetchedAt()}
      />,
      { route: "/app/deployment/repo/r1" },
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    notifyBuildStatus("live-1", "Succeeded");

    const settled = [
      {
        ...runningBuild[0],
        status: "Succeeded",
        lastUpdatedDate: "2026-09-08T08:12:48.000Z",
      },
    ] as unknown as IPipeline[];

    rerender(
      <DeploymentObservability
        builds={settled}
        viewLatestBuild
        dataUpdatedAt={new Date("2026-09-08T08:12:50.000Z").getTime()}
      />,
    );

    expect(screen.getByText("Deployed in 3m 42s")).toBeInTheDocument();
  });

  it("says a failed deployment failed rather than that it deployed", () => {
    const failed = [
      {
        ...runningBuild[0],
        status: "Failed",
        lastUpdatedDate: "2026-09-08T08:12:48.000Z",
      },
    ] as unknown as IPipeline[];

    renderWithProviders(
      <DeploymentObservability
        builds={failed}
        viewLatestBuild
        dataUpdatedAt={fetchedAt()}
      />,
      { route: "/app/deployment/repo/r1" },
    );

    expect(screen.getByText("Failed after 3m 42s")).toBeInTheDocument();
  });

  // A history row that was already finished when it rendered must report only what the
  // server measured. Data served from cache can be minutes old, and counting from the
  // fetch would add that wait to a duration that is already final.
  it("leaves an already-finished row's total alone however stale the response is", () => {
    const finished = [
      {
        ...runningBuild[0],
        status: "Succeeded",
        lastUpdatedDate: "2026-09-08T08:12:48.000Z",
      },
    ] as unknown as IPipeline[];

    renderWithProviders(
      <DeploymentObservability
        builds={finished}
        dataUpdatedAt={fetchedAt() - 240_000}
      />,
      { route: "/app/deployment/repo/r1" },
    );

    expect(screen.getByText("Deployed in 3m 42s")).toBeInTheDocument();
  });
});
