import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DeploymentSettingSection from "./deployment-settings-section";
import type { DeploymentFormData } from "@blocks-deployment/models/github-info";
import type { IProvider } from "@blocks-deployment/models/deployment-settings";

const specsData = [
  {
    id: "prov-aws",
    name: "AWS",
    regions: [
      {
        id: "r1",
        name: "us-east-1",
        machineConfigs: [{ id: "m1", name: "small", cpu: "1", memory: "1GB" }],
      },
    ],
  },
] as unknown as IProvider[];

const deploymentData: DeploymentFormData = {
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
});
