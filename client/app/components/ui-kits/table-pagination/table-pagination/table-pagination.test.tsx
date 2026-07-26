import { fireEvent, render, screen } from "@testing-library/react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";
import { TablePagination } from "./table-pagination";

const data = Array.from({ length: 25 }).map((_, i) => ({ id: i, name: `r${i}` }));
const columns = [{ id: "name", accessorKey: "name" }];

const Harness = ({ totalCount }: { totalCount?: number }) => {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });
  return <TablePagination table={table} onPageChange={vi.fn()} totalCount={totalCount} />;
};

describe("TablePagination (nested variant)", () => {
  it("renders and navigates the pages", () => {
    render(<Harness />);
    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 2]);
    expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
  });

  it("shows the total item count when provided", () => {
    render(<Harness totalCount={1} />);
    expect(screen.getByText("Total 1 item")).toBeInTheDocument();
  });
});
