import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { ProjectCard } from "./project-card";
import { ProjectCardLoading } from "./loading";
import type { IProject } from "@blocks-identifier/models/project.model";

const makeProject = (env: string): IProject =>
  ({
    itemId: `p-${env}`,
    tenantGroupId: "tg1",
    name: `Project ${env}`,
    environment: env,
  }) as IProject;

describe("ProjectCard", () => {
  it("renders the project name and opens on configure", () => {
    const projects = [makeProject("dev")];
    renderWithProviders(
      <ProjectCard project={projects[0]} projects={projects} />,
    );
    expect(screen.getByText("Project dev")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button")[0]);
  });

  it("renders a no-environments chip", () => {
    const project = makeProject("dev");
    renderWithProviders(<ProjectCard project={project} projects={[]} />);
    expect(screen.getByText("No environments")).toBeInTheDocument();
  });

  it("collapses more than three environments", () => {
    const projects = ["dev", "prod", "staging", "qa", "demo"].map(makeProject);
    renderWithProviders(
      <ProjectCard project={projects[0]} projects={projects} />,
    );
    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});

describe("ProjectCardLoading", () => {
  it("renders a skeleton card", () => {
    const { container } = renderWithProviders(<ProjectCardLoading />);
    expect(container.firstChild).toBeTruthy();
  });
});
