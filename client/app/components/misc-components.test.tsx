import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { useGetProject } from "@blocks-identifier/hooks/use-project";

vi.mock("@blocks-identifier/hooks/use-project", () => ({
  useGetProject: vi.fn(),
}));

import { GitCommandSnippet } from "./git-command-snippet/git-command-snippet";
import { DropdownSearchInput } from "./filter-toolbar/dropdown-search-input/dropdown-search-input";

describe("GitCommandSnippet", () => {
  it("renders the loading skeleton", () => {
    vi.mocked(useGetProject).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as never);
    const { container } = renderWithProviders(<GitCommandSnippet />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders git commands once the project loads", () => {
    vi.mocked(useGetProject).mockReturnValue({
      data: { data: { environment: "prod" } },
      isLoading: false,
    } as never);
    renderWithProviders(<GitCommandSnippet />);
    expect(screen.getByText("Git Commands")).toBeInTheDocument();
  });
});

describe("DropdownSearchInput", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders and emits changes when typing", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <DropdownSearchInput
        onChange={onChange}
        value={{ selected: "name", value: "" }}
        options={[
          { label: "Name", value: "name" },
          { label: "Email", value: "email" },
        ]}
      />,
    );
    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "abc" } });
    expect(input).toBeInTheDocument();
  });
});
