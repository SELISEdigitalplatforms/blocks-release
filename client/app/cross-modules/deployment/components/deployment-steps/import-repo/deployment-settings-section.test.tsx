import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DeploymentSettingSection from "./deployment-settings-section";
import type { DeploymentFormData } from "@blocks-deployment/models/github-info";
import type { IProvider } from "@blocks-deployment/models/deployment-settings";

const specsData = [
  {
    id: "prov-aws",
    name: "AWS",
    status: "active",
    region: [
      {
        id: "r1",
        name: "us-east-1",
        status: "active",
        machineSpecs: [
          { id: "m1", name: "small", cpu: "1", memory: "1GB", status: "active" },
        ],
      },
    ],
  },
] as unknown as IProvider[];

const deploymentData: DeploymentFormData = {
  customDomain: "",
  lastDeploymentStatus: "",
  deploymentType: "auto",
  framework: "react",
  provider: "AWS",
  region: "us-east-1",
  selectedSpec: "",
};

const emptyDeployment: DeploymentFormData = {
  customDomain: "",
  lastDeploymentStatus: "",
  deploymentType: "auto",
  framework: "react",
  provider: "",
  region: "",
  selectedSpec: "",
};

describe("DeploymentSettingSection", () => {
  it("renders and reports deployment-type changes", () => {
    const onChange = vi.fn();
    render(
      <DeploymentSettingSection
        selectedRepo="acme/app"
        selectedBranch="main"
        specsData={specsData}
        deploymentData={deploymentData}
        onDeploymentDataChange={onChange}
      />,
    );
    // At least one deployment option label is present.
    expect(screen.getAllByText(/deployment/i).length).toBeGreaterThan(0);
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("prompts for a region when none is selected", () => {
    render(
      <DeploymentSettingSection
        selectedRepo="acme/app"
        selectedBranch="main"
        specsData={specsData}
        deploymentData={emptyDeployment}
        onDeploymentDataChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText(
        "Please select a region first to view available specifications",
      ),
    ).toBeInTheDocument();
  });

  it("selects a provider from the dropdown and resets dependent fields", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onChange = vi.fn();
    render(
      <DeploymentSettingSection
        selectedRepo="acme/app"
        selectedBranch="main"
        specsData={specsData}
        deploymentData={emptyDeployment}
        onDeploymentDataChange={onChange}
      />,
    );
    await user.click(screen.getByText("Select a provider"));
    await user.click(await screen.findByRole("menuitem", { name: "AWS" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "AWS", providerId: "prov-aws" }),
    );
  });

  it("selects a region from the dropdown", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onChange = vi.fn();
    render(
      <DeploymentSettingSection
        selectedRepo="acme/app"
        selectedBranch="main"
        specsData={specsData}
        deploymentData={{ ...emptyDeployment, provider: "AWS" }}
        onDeploymentDataChange={onChange}
      />,
    );
    await user.click(screen.getByText("Select a region"));
    await user.click(await screen.findByRole("menuitem", { name: "us-east-1" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ region: "us-east-1", regionId: "r1" }),
    );
  });

  it("selects a machine specification", () => {
    const onChange = vi.fn();
    render(
      <DeploymentSettingSection
        selectedRepo="acme/app"
        selectedBranch="main"
        specsData={specsData}
        deploymentData={deploymentData}
        onDeploymentDataChange={onChange}
      />,
    );
    // The single active machine spec renders as a selectable button (cpu "1").
    const specButton = screen
      .getAllByRole("button")
      .find((b) => (b.textContent || "").trim() === "1");
    fireEvent.click(specButton as HTMLElement);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ machineConfigId: "m1" }),
    );
  });
});
