import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeploymentActivity from "./deployment-activity";

const mocks = vi.hoisted(() => ({ query: vi.fn(), refetch: vi.fn(), chart: vi.fn() }));
vi.mock("@blocks-deployment/hooks/use-deployment-activity", () => ({
  useDeploymentActivity: mocks.query,
}));
vi.mock("@/hooks/use-scoped-path", () => ({
  useScopedPath: () => (path: string) => `/app/${path}`,
}));
vi.mock("@/components/ui/contribution-skyline", () => ({
  default: (props: { onCellClick: (day: { date: string; count: number }) => void }) => {
    mocks.chart(props);
    const { onCellClick } = props;
    return (
      <>
        <button onClick={() => onCellClick({ date: "2026-10-11", count: 2 })}>
          Select active day
        </button>
        <button onClick={() => onCellClick({ date: "2026-10-10", count: 0 })}>
          Select empty day
        </button>
      </>
    );
  },
}));
const renderActivity = () =>
  render(
    <MemoryRouter>
      <DeploymentActivity repoId="179" branch="main" />
    </MemoryRouter>,
  );

describe("deployment activity day links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockReturnValue({
      data: {
        days: [{ date: "2026-10-11", count: 2 }],
        builds: [
          {
            itemId: "b/1",
            createdDate: "2026-10-11T12:00:00.000Z",
            branch: "main",
            status: "Succeeded",
          },
          {
            itemId: "b2",
            createdDate: "2026-10-11T13:00:00.000Z",
            branch: "main",
            status: "Failed",
          },
        ],
      },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
    });
  });

  it("links each selected day's attempts to the current repository's deployment logs", () => {
    renderActivity();
    fireEvent.click(screen.getByRole("button", { name: "Select active day" }));
    expect(screen.getByRole("region", { name: "Deployments on Oct 11, 2026" })).toBeVisible();
    expect(screen.getByRole("link", { name: /b\/1/ })).toHaveAttribute(
      "href",
      "/app/deployment/repo/179/deployment-logs/b%2F1?tab=deployment-logs",
    );
    expect(screen.getByRole("link", { name: /b2/ })).toHaveTextContent("Failed");
    expect(screen.getByText("12:00 PM UTC")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear selected day" }));
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("shows an empty day without linking to unrelated history", () => {
    renderActivity();
    fireEvent.click(screen.getByRole("button", { name: "Select empty day" }));
    expect(screen.getByText("No deployments on this day.")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("offers retry when the activity request fails", () => {
    mocks.query.mockReturnValue({
      isPending: false,
      isError: true,
      isFetching: false,
      refetch: mocks.refetch,
    });
    renderActivity();
    expect(screen.getByRole("status")).toHaveTextContent("Deployment activity is unavailable.");
    fireEvent.click(screen.getByRole("button", { name: "Retry activity" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });

  it("renders available records without claiming a complete annual total when paging stops", () => {
    const cached = mocks.query();
    mocks.query.mockReturnValue({ ...cached, data: { ...cached.data, isPartial: true } });
    renderActivity();
    expect(mocks.chart.mock.calls[0][0]).toMatchObject({
      title: "2 recorded deployments",
      showStats: false,
    });
    expect(screen.getByText(/Available deployment attempts/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Select active day" }));
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("keeps cached activity visible when a background refresh fails", () => {
    mocks.query.mockReturnValue({ ...mocks.query(), isError: true });
    renderActivity();
    expect(screen.queryByRole("button", { name: "Retry activity" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select active day" })).toBeVisible();
  });
});
