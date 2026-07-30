import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProgressBar from "./progress-bar";
import type { IIncidentSummaries } from "@blocks-deployment/models/alerts.model";

describe("ProgressBar", () => {
  it("renders 24 bars at 100% when up with no incidents", () => {
    const { container } = render(<ProgressBar incidents={[]} status={true} />);
    const bars = container.querySelectorAll(".h-6.w-\\[4\\.4px\\]");
    expect(bars.length).toBe(24);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders 0% when down with no incidents", () => {
    render(<ProgressBar incidents={[]} status={false} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("accounts for an ongoing incident and shows a tooltip on hover", () => {
    const now = new Date();
    const incidents: IIncidentSummaries[] = [
      {
        startTime: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        endTime: null,
      } as unknown as IIncidentSummaries,
    ];
    const { container } = render(
      <ProgressBar incidents={incidents} status={false} />,
    );
    const bars = container.querySelectorAll(".h-6.w-\\[4\\.4px\\]");
    fireEvent.mouseEnter(bars[bars.length - 1]);
    // Tooltip content includes an Up/Down label.
    expect(container.textContent).toMatch(/Up|Down/);
    fireEvent.mouseLeave(bars[bars.length - 1]);
  });
});
