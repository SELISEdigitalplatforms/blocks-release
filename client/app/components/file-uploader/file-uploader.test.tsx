import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  FileInput,
  FileUploader,
  FileUploaderContent,
  FileUploaderItem,
  useFileUpload,
} from "./file-uploader";

const Harness = ({
  value,
  onValueChange,
}: {
  value: File[] | null;
  onValueChange: (v: File[] | null) => void;
}) => (
  <FileUploader
    value={value}
    onValueChange={onValueChange}
    dropzoneOptions={{ maxFiles: 2, multiple: true }}
  >
    <FileInput>
      <span>Drop files here</span>
    </FileInput>
    <FileUploaderContent>
      {(value ?? []).map((file, i) => (
        <FileUploaderItem key={i} index={i}>
          {file.name}
        </FileUploaderItem>
      ))}
    </FileUploaderContent>
  </FileUploader>
);

describe("FileUploader", () => {
  it("renders the input and existing files", () => {
    render(
      <Harness value={[new File(["x"], "a.png")]} onValueChange={vi.fn()} />,
    );
    expect(screen.getByText("Drop files here")).toBeInTheDocument();
    expect(screen.getByText("a.png")).toBeInTheDocument();
  });

  it("removes a file when its remove button is clicked", () => {
    const onValueChange = vi.fn();
    render(
      <Harness
        value={[new File(["x"], "a.png"), new File(["y"], "b.png")]}
        onValueChange={onValueChange}
      />,
    );
    const removeButtons = screen.getAllByRole("button");
    fireEvent.click(removeButtons[0]);
    expect(onValueChange).toHaveBeenCalled();
  });

  it("useFileUpload throws outside a provider", () => {
    const Bad = () => {
      useFileUpload();
      return null;
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/FileUploaderProvider/);
    spy.mockRestore();
  });
});
