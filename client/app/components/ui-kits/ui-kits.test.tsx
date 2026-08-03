import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Pagination } from "./pagination/pagination";
import { TablePagination } from "./table-pagination/table-pagination";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb/breadcrumb";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "./input-otp/input-otp";

describe("Pagination", () => {
  it("navigates pages and changes page size", () => {
    const onChange = vi.fn();
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        page={1}
        pageSize={10}
        totalCount={40}
        pageSizeOptions={[10, 20]}
        onChange={onChange}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    fireEvent.click(buttons[0]);
    expect(onChange).toHaveBeenCalled();
  });
});

const TableHarness = ({ totalCount }: { totalCount?: number }) => {
  const table = useReactTable({
    data: [{ id: 1 }, { id: 2 }],
    columns: [{ id: "id", accessorKey: "id" }],
    getCoreRowModel: getCoreRowModel(),
  });
  return <TablePagination table={table} totalCount={totalCount} />;
};

describe("TablePagination", () => {
  it("renders selection summary", () => {
    render(<TableHarness />);
    expect(screen.getByText(/row\(s\) selected/i)).toBeInTheDocument();
  });

  it("renders total count summary", () => {
    render(<TableHarness totalCount={2} />);
    expect(screen.getByText(/Total 2 items/i)).toBeInTheDocument();
  });
});

describe("Breadcrumb", () => {
  it("renders a full breadcrumb trail", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Current</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });
});

describe("InputOTP", () => {
  it("renders slots and a separator", () => {
    const { container } = render(
      <InputOTP maxLength={4} render={undefined as never}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={2} />
          <InputOTPSlot index={3} />
        </InputOTPGroup>
      </InputOTP>,
    );
    expect(container.firstChild).toBeTruthy();
  });
});
