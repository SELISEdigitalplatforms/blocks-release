import { render, screen, act } from "@testing-library/react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { Toaster } from "./toaster/toaster";
import { toast } from "@/hooks/use-toast";
import {
  Drawer as NestedDrawer,
  DrawerContent as NestedDrawerContent,
  DrawerTitle as NestedDrawerTitle,
} from "./drawer/drawer/drawer";
import {
  Breadcrumb as NestedBreadcrumb,
  BreadcrumbList as NestedBreadcrumbList,
  BreadcrumbItem as NestedBreadcrumbItem,
  BreadcrumbPage as NestedBreadcrumbPage,
} from "./breadcrumb/breadcrumb/breadcrumb";
import { TablePagination as NestedTablePagination } from "./table-pagination/table-pagination/table-pagination";

describe("Toaster", () => {
  it("renders active toasts", () => {
    render(<Toaster />);
    act(() => {
      toast({ title: "Saved", description: "All good" });
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });
});

describe("nested duplicate ui-kits", () => {
  it("renders the nested Drawer", () => {
    render(
      <NestedDrawer open>
        <NestedDrawerContent>
          <NestedDrawerTitle>Nested drawer</NestedDrawerTitle>
        </NestedDrawerContent>
      </NestedDrawer>,
    );
    expect(screen.getByText("Nested drawer")).toBeInTheDocument();
  });

  it("renders the nested Breadcrumb", () => {
    render(
      <NestedBreadcrumb>
        <NestedBreadcrumbList>
          <NestedBreadcrumbItem>
            <NestedBreadcrumbPage>Now</NestedBreadcrumbPage>
          </NestedBreadcrumbItem>
        </NestedBreadcrumbList>
      </NestedBreadcrumb>,
    );
    expect(screen.getByText("Now")).toBeInTheDocument();
  });

  it("renders the nested TablePagination", () => {
    const Harness = () => {
      const table = useReactTable({
        data: [{ id: 1 }],
        columns: [{ id: "id", accessorKey: "id" }],
        getCoreRowModel: getCoreRowModel(),
      });
      return <NestedTablePagination table={table} totalCount={1} />;
    };
    render(<Harness />);
    expect(screen.getByText(/Total 1 item/i)).toBeInTheDocument();
  });
});
