import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "./ui-kits/dialog/dialog";
import {
  ChipsInput,
  ChipsInputField,
  ChipsInputList,
  useChipsContext,
} from "./chip-input/chips-input";
import ConfirmationModal from "./confirmation-modal/confirmation-modal";
import { ErrorDisplay } from "./error-display";
import { ErrorBoundary } from "./error-boundary";

describe("ChipsInput", () => {
  const Harness = ({
    value,
    onChange,
  }: {
    value: string[];
    onChange: (v: string[]) => void;
  }) => (
    <ChipsInput value={value} onChange={onChange} validatorRegex={/^[a-z]+$/}>
      <ChipsInputList />
      <ChipsInputField />
    </ChipsInput>
  );

  it("adds a valid chip on Enter", () => {
    const onChange = vi.fn();
    render(<Harness value={["one"]} onChange={onChange} />);
    const input = screen.getByPlaceholderText("Type and press enter");
    fireEvent.change(input, { target: { value: "two" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["one", "two"]);
  });

  it("shows a validation error and blocks invalid chips", () => {
    const onChange = vi.fn();
    render(<Harness value={[]} onChange={onChange} />);
    const input = screen.getByPlaceholderText("Type and press enter");
    fireEvent.change(input, { target: { value: "123" } });
    expect(screen.getByText("Invalid format")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a chip", () => {
    const onChange = vi.fn();
    render(<Harness value={["one", "two"]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Remove one"));
    expect(onChange).toHaveBeenCalledWith(["two"]);
  });

  it("throws when the context is used outside the provider", () => {
    const Bad = () => {
      useChipsContext();
      return null;
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/must be used within/);
    spy.mockRestore();
  });
});

describe("ConfirmationModal", () => {
  it("renders the dialog content and confirms", () => {
    const onConfirm = vi.fn();
    render(
      <Dialog open>
        <ConfirmationModal
          data={{ dialogTitle: "Delete?", dialogSubtitle: "Are you sure?" }}
          onCancel={vi.fn()}
          onConfirm={onConfirm}
        />
      </Dialog>,
    );
    expect(screen.getByText("Delete?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});

describe("ErrorDisplay", () => {
  it("renders the provided text", () => {
    render(<ErrorDisplay text="Boom" />);
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });
});

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div>safe</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("safe")).toBeInTheDocument();
  });

  it("renders the fallback UI when a child throws", () => {
    const Boom = () => {
      throw new Error("kaboom");
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("kaboom")).toBeInTheDocument();
    spy.mockRestore();
  });
});
