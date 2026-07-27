import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import DeploymentGeneralInfo from "./shared/deployment-general-info";
import { NoDeploymentAvailable } from "./shared/no-deployment";
import { NoRepositoryAvailable } from "./shared/no-repository";
import { ErrorRepository } from "./shared/error-repository";
import { NoBranch } from "./tabs/no-branch";
import ContainerWaiting from "./tabs/sca-waiting-card";

const cardData = {
  repoUrl: "https://github.com/acme/app",
  defaultDeploymentUrl: "https://app.dev",
  customDeploymentUrl: "https://app.custom",
  status: "Succeeded",
  createdDate: "2024-01-01T00:00:00Z",
} as never;

describe("DeploymentGeneralInfo", () => {
  it("renders general info in the success state", () => {
    renderWithProviders(
      <DeploymentGeneralInfo cardData={cardData} isSuccess buildId="b1" />,
    );
    expect(screen.getByText("General information")).toBeInTheDocument();
    expect(screen.getByText("https://github.com/acme/app")).toBeInTheDocument();
  });

  it("renders the loading skeleton", () => {
    const { container } = renderWithProviders(
      <DeploymentGeneralInfo cardData={undefined} isLoading />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders the error state", () => {
    renderWithProviders(
      <DeploymentGeneralInfo cardData={undefined} isError />,
    );
    expect(
      screen.getByText("Failed to load deployment information"),
    ).toBeInTheDocument();
  });
});

describe("empty/waiting states", () => {
  it("renders NoDeploymentAvailable", () => {
    renderWithProviders(<NoDeploymentAvailable />);
    expect(screen.getByText("No deployments available")).toBeInTheDocument();
  });

  it("renders NoRepositoryAvailable", () => {
    renderWithProviders(<NoRepositoryAvailable />);
    expect(screen.getByText("No repository added")).toBeInTheDocument();
  });

  it("renders ErrorRepository", () => {
    const { container } = renderWithProviders(
      <ErrorRepository refetch={() => {}} />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders NoBranch with the environment name", () => {
    renderWithProviders(<NoBranch projectEnvironment="dev" />);
    expect(screen.getByText("No Repository available")).toBeInTheDocument();
  });

  it("renders the SCA container-waiting card", () => {
    renderWithProviders(<ContainerWaiting type="container" />);
    expect(screen.getByText("Container Image Scan")).toBeInTheDocument();
  });

  it("renders the SCA overall-waiting card", () => {
    renderWithProviders(<ContainerWaiting type="overall" />);
    expect(
      screen.getByText("Software Composition Analysis"),
    ).toBeInTheDocument();
  });
});
