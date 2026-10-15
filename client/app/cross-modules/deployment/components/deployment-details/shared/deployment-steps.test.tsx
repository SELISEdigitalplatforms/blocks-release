import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DeploymentSteps, { BuildStageIcon } from "./deployment-steps";

const event = (eventGroup: string, eventType: string, createdAt = "2026-10-11T10:00:00Z") => ({
  id: `${eventGroup}-${eventType}`,
  buildId: "b1",
  eventGroup,
  eventType,
  message: "",
  createdAt,
  lastUpdateDate: createdAt,
});

describe("DeploymentSteps", () => {
  it("shows how far a running build has got", () => {
    render(
      <DeploymentSteps
        buildId="b1"
        events={[
          event("Clone", "EventStarted", "2026-10-11T10:00:00Z"),
          event("Clone", "EventFinished", "2026-10-11T10:00:12Z"),
          event("Build", "EventStarted", "2026-10-11T10:00:13Z"),
        ]}
      />,
    );
    const steps = within(screen.getByRole("list", { name: "Deployment steps" }));
    expect(steps.getAllByRole("listitem")).toHaveLength(5);
    expect(steps.getByRole("listitem", { name: "Clone: succeeded, ~12s" })).toBeInTheDocument();
    expect(steps.getByRole("listitem", { name: "Build: running" })).toHaveAttribute(
      "title",
      "Build: running",
    );
    expect(steps.getByRole("listitem", { name: "Deploy: not started" })).toBeInTheDocument();
  });

  it("marks the step a failed build stopped at", () => {
    render(
      <DeploymentSteps
        buildId="b1"
        events={[event("Clone", "EventFinished"), event("Build", "EventFailed")]}
      />,
    );
    expect(screen.getByRole("listitem", { name: /^Build: failed/ })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: "SCA: not started" })).toBeInTheDocument();
  });

  it("renders nothing without step events", () => {
    const { container } = render(<DeploymentSteps buildId="b1" events={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("gives the build the icon of the stage it failed at", () => {
    const { container } = render(
      <BuildStageIcon
        buildId="b1"
        events={[event("Clone", "EventFinished"), event("Build", "EventFailed")]}
      />,
    );
    expect(container.firstChild).toHaveClass("bg-sunset-soft");
  });

  it("falls back to the Deploy icon without step events", () => {
    const { container } = render(<BuildStageIcon buildId="b1" events={[]} />);
    expect(container.firstChild).toHaveClass("bg-forest-soft");
  });
});
