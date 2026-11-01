import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import ContainerWaiting, { ReportUnavailableCard } from "./sca-waiting-card";

describe("ContainerWaiting", () => {
  it("announces the overall Data Processing card as a status", () => {
    renderWithProviders(<ContainerWaiting type="overall" />);
    const card = screen.getByRole("status");
    expect(card).toHaveTextContent("Software Composition Analysis");
    expect(card).toHaveTextContent("Data Processing");
    expect(card).toHaveTextContent("Analysis in progress");
  });

  it("keeps the container card without a status role", () => {
    renderWithProviders(<ContainerWaiting type="container" />);
    expect(screen.getByText("Container Image Scan")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("ReportUnavailableCard", () => {
  it("renders NotRun with an amber icon, the message and the action", () => {
    renderWithProviders(
      <ReportUnavailableCard
        title="Static Application Security Testing"
        status="NotRun"
        message="The sonar-scan step did not run."
        action={<button type="button">Open tool</button>}
      />,
    );
    expect(screen.getByText("Static Application Security Testing")).toBeInTheDocument();
    expect(screen.getByText("Scan did not run")).toBeInTheDocument();
    expect(screen.getByText("The sonar-scan step did not run.")).toHaveClass(
      "text-muted-foreground",
    );
    expect(screen.getByRole("button", { name: "Open tool" })).toBeInTheDocument();
    const icon = screen.getByTestId("report-unavailable-icon");
    expect(icon).toHaveClass("text-amber-600");
    expect(icon).not.toHaveClass("text-red-600");
  });

  it("renders Failed with a red icon and no message paragraph when none is given", () => {
    const { container } = renderWithProviders(
      <ReportUnavailableCard
        title="Software Composition Analysis"
        status="Failed"
        action={<button type="button">Open tool</button>}
      />,
    );
    expect(screen.getByText("Results not captured")).toBeInTheDocument();
    expect(screen.getByTestId("report-unavailable-icon")).toHaveClass("text-red-600");
    expect(container.querySelector('p[class="text-muted-foreground"]')).toBeNull();
  });
});
