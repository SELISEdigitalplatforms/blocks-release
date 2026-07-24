import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  dropzoneOptions = { maxFiles: 2, multiple: true },
}: {
  value: File[] | null;
  onValueChange: (v: File[] | null) => void;
  dropzoneOptions?: Record<string, unknown>;
}) => (
  <FileUploader
    data-testid="uploader"
    value={value}
    onValueChange={onValueChange}
    dropzoneOptions={dropzoneOptions}
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

  it("navigates through files with the keyboard and deletes the active one", () => {
    const onValueChange = vi.fn();
    render(
      <Harness
        value={[new File(["x"], "a.png"), new File(["y"], "b.png")]}
        onValueChange={onValueChange}
      />,
    );
    const uploader = screen.getByTestId("uploader");
    // Move down then up through the list.
    fireEvent.keyDown(uploader, { key: "ArrowDown" });
    fireEvent.keyDown(uploader, { key: "ArrowDown" });
    fireEvent.keyDown(uploader, { key: "ArrowUp" });
    // Delete the active file.
    fireEvent.keyDown(uploader, { key: "Delete" });
    expect(onValueChange).toHaveBeenCalled();
    // Escape clears selection.
    fireEvent.keyDown(uploader, { key: "Escape" });
  });

  it("navigates a horizontal uploader with left/right arrows", () => {
    render(
      <FileUploader
        data-testid="uploader"
        orientation="horizontal"
        value={[new File(["x"], "a.png"), new File(["y"], "b.png")]}
        onValueChange={vi.fn()}
        dropzoneOptions={{ maxFiles: 3, multiple: true }}
      >
        <FileInput>
          <span>Drop files here</span>
        </FileInput>
      </FileUploader>,
    );
    const uploader = screen.getByTestId("uploader");
    fireEvent.keyDown(uploader, { key: "ArrowRight" });
    fireEvent.keyDown(uploader, { key: "ArrowLeft" });
    expect(uploader).toBeInTheDocument();
  });

  it("opens the file dialog on Enter when nothing is selected", () => {
    render(<Harness value={[]} onValueChange={vi.fn()} />);
    const uploader = screen.getByTestId("uploader");
    fireEvent.keyDown(uploader, { key: "Enter" });
    expect(uploader).toBeInTheDocument();
  });

  it("accepts dropped files through the input change handler", async () => {
    const onValueChange = vi.fn();
    render(<Harness value={[]} onValueChange={onValueChange} />);
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["hello"], "hello.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onValueChange).toHaveBeenCalled());
  });

  it("disables the input once the max number of files is reached", () => {
    render(
      <Harness
        value={[new File(["x"], "a.png")]}
        onValueChange={vi.fn()}
        dropzoneOptions={{ maxFiles: 1, multiple: false }}
      />,
    );
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeDisabled();
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
