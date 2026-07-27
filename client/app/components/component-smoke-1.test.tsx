import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/test-providers/render";
import { MaskedText } from "./masked-text/masked-text";
import { InfoTooltip } from "./info-tool-tip/info-tool-tip";
import { TooltipProvider } from "./ui-kits/tooltip/tooltip";
import PageBreadcrumb from "./breadcrumb/breadcrumb";
import { BackIconButton } from "./buttons";
import { ConfigureButton } from "./action-buttons/configure-button";
import { PrimaryButton } from "./action-buttons/primary-button";
import { BackToConsoleNavigator } from "./back-to-console-navigator";
import { SearchInput } from "./search-input/search-input";
import { PasswordInput } from "./password-input/password-input";

describe("MaskedText", () => {
  it("masks the middle and reveals first/last characters", () => {
    render(<MaskedText text="abcdef" showFirstN={1} showLastN={1} />);
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("f")).toBeInTheDocument();
    expect(screen.getByText("****")).toBeInTheDocument();
  });

  it("uses an explicit length and never goes negative", () => {
    render(<MaskedText text="ab" length={0} char="#" />);
    // maskedCount clamps to 0, so no masked span content.
    expect(screen.queryByText("#")).not.toBeInTheDocument();
  });
});

describe("InfoTooltip", () => {
  it("renders the help trigger", () => {
    render(
      <TooltipProvider>
        <InfoTooltip content="Help me" side="right" />
      </TooltipProvider>,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});

describe("PageBreadcrumb", () => {
  it("renders breadcrumb segments for the current route", () => {
    renderWithProviders(<PageBreadcrumb />, { route: "/app/create-project" });
    expect(screen.getByText("App")).toBeInTheDocument();
  });

  it("slices the breadcrumb when an index is given", () => {
    renderWithProviders(<PageBreadcrumb breadcrumbIndex={2} />, {
      route: "/app/create-project",
    });
    expect(screen.getByText("Create Project")).toBeInTheDocument();
  });
});

describe("buttons", () => {
  it("BackIconButton calls onClick", () => {
    const onClick = vi.fn();
    render(<BackIconButton onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /go back/i }));
    expect(onClick).toHaveBeenCalled();
  });

  it("ConfigureButton calls onClick", () => {
    const onClick = vi.fn();
    render(<ConfigureButton onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
  });

  it("PrimaryButton renders its label and fires onClick", () => {
    const onClick = vi.fn();
    render(<PrimaryButton label="Create" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /create/i }));
    expect(onClick).toHaveBeenCalled();
  });
});

describe("BackToConsoleNavigator", () => {
  it("links back to the console", () => {
    renderWithProviders(<BackToConsoleNavigator />);
    expect(screen.getByText("Back to console")).toBeInTheDocument();
    expect(screen.getByText("Console")).toBeInTheDocument();
  });
});

describe("SearchInput", () => {
  it("emits changes and clears the value", () => {
    const onSearch = vi.fn();
    const setIsVisible = vi.fn();
    const { rerender } = render(
      <SearchInput
        onSearch={onSearch}
        value="abc"
        isVisible={true}
        setIsVisible={setIsVisible}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Search..."), {
      target: { value: "xyz" },
    });
    expect(onSearch).toHaveBeenCalledWith("xyz");
    // Clear button appears because value is truthy.
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onSearch).toHaveBeenCalledWith("");
    rerender(
      <SearchInput
        onSearch={onSearch}
        value=""
        isVisible={true}
        setIsVisible={setIsVisible}
      />,
    );
  });

  it("renders a toggle button when collapsed", () => {
    const setIsVisible = vi.fn();
    render(
      <SearchInput
        onSearch={vi.fn()}
        value=""
        toggleable
        isVisible={false}
        setIsVisible={setIsVisible}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(setIsVisible).toHaveBeenCalledWith(true);
  });
});

describe("PasswordInput", () => {
  it("toggles password visibility", () => {
    render(<PasswordInput placeholder="Password" />);
    const input = screen.getByPlaceholderText("Password") as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.click(screen.getByRole("button"));
    expect(input.type).toBe("text");
    fireEvent.click(screen.getByRole("button"));
    expect(input.type).toBe("password");
  });
});
