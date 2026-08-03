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

const Harness = ({
  onPageChange,
  totalCount,
}: {
  onPageChange?: (p: number) => void;
  totalCount?: number;
}) => {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });
  return (
    <TablePagination
      table={table}
      onPageChange={onPageChange}
      totalCount={totalCount}
    />
  );
};

describe("TablePagination", () => {
  it("moves through pages with the navigation buttons", () => {
    const onPageChange = vi.fn();
    render(<Harness onPageChange={onPageChange} />);
    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    const buttons = screen.getAllByRole("button");
    // Next, last, first, previous chevrons in order.
    fireEvent.click(buttons[buttons.length - 2]); // next
    fireEvent.click(buttons[buttons.length - 1]); // last
    fireEvent.click(buttons[0]); // first
    fireEvent.click(buttons[1]); // previous
    expect(onPageChange).toHaveBeenCalled();
  });

  it("shows the total item count when provided", () => {
    render(<Harness totalCount={42} />);
    expect(screen.getByText("Total 42 items")).toBeInTheDocument();
  });

  it("shows selected row info when no total count is given", () => {
    render(<Harness />);
    expect(screen.getByText(/row\(s\) selected/)).toBeInTheDocument();
  });
});
