import { ScrollArea, ScrollBar } from "@/components/ui-kits/scroll-area/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { FilterControls, useSortQueryParams } from "@/components/filter-toolbar";
import { useMemo } from "react";
import { CellContext, ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { parseAsInteger, useQueryStates } from "nuqs";
import { IncidentTree } from "@blocks-devops/models/alerts";

type IncidentListProps = {
  data: IncidentTree[];
  showLastStatus?: boolean;
  totalCount?: number;
  pageNumber?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
};

export const useAlertFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    page: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
  });
  return { queryParams, setQueryParams };
};

const useIncidentSortQueryParams = () =>
  useSortQueryParams({ initial: { property: "status", isDescending: false } });

const IncidentList = ({
  data,
  showLastStatus,
  totalCount=0,
  pageNumber,
  pageSize=10,
  onPageChange,
}: IncidentListProps) => {
  const { setQueryParams } = useAlertFilterQueryParams();
  const { sortQueryParams, setSortQueryParams } = useIncidentSortQueryParams();

  const handlePageChange = onPageChange || ((page: number) =>
    setQueryParams((params) => ({ ...params, page }))
  );

  const parseFailureReason = (reason?: string | null): string | undefined => {
  if (!reason) return undefined; // instead of null
  try {
    const parsed = JSON.parse(reason);
    return parsed?.error || reason;
  } catch {
    return reason.replace(/\\n/g, "").trim() || undefined;
  }
};


  const columns = useMemo<ColumnDef<IncidentTree>[]>(
    () => {
      const cols: ColumnDef<IncidentTree>[] = [
        {
          accessorKey: "status",
          header: () => (
            <FilterControls.SortHeader
              id="status"
              label="Status"
              value={sortQueryParams}
              onChange={setSortQueryParams}
            />
          ),
          cell: ({ row }) => {
            const isResolved = row.original.isResolved;
            const statusClass = isResolved
              ? "text-green-600 bg-green-100 px-2 py-1 rounded-full"
              : "text-red-600 bg-red-100 px-2 py-1 rounded-full";
            return (
              <div className="ml-2 flex w-[100px] flex-row items-center gap-2 sm:ml-0">
                <span className={statusClass}>{isResolved ? "Resolved" : "Unresolved"}</span>
              </div>
            );
          },
        },
        ...(showLastStatus
          ? [
              {
                accessorKey: "lastStatusCode",
                header: () => (
                  <FilterControls.SortHeader
                    id="lastStatusCode"
                    label="Status Code"
                    value={sortQueryParams}
                    onChange={setSortQueryParams}
                  />
                ),
                cell: (cell: CellContext<IncidentTree, string | undefined>) => (
                  <div className="ml-2 flex items-center sm:ml-0 sm:w-[100px]">
                    <span>{cell.row.original.lastStatusCode}</span>
                  </div>
                ),
              },
            ]
          : []),
        {
          accessorKey: "rootCause",
          header: () => (
            <FilterControls.SortHeader
              id="rootCause"
              label="Root cause"
              value={sortQueryParams}
              onChange={setSortQueryParams}
            />
          ),
          cell: ({ row }) => (
            <div className="ml-2 flex items-center sm:ml-0 sm:w-[100px]">
              <span>{parseFailureReason(row.original.failureReason)}</span>
            </div>
          ),
        },
        {
          accessorKey: "started_time",
          header: () => (
            <FilterControls.SortHeader
              id="started_time"
              label="Start time"
              value={sortQueryParams}
              onChange={setSortQueryParams}
            />
          ),
          cell: ({ row }) => {
            const started = new Date(row.original.startTime).toLocaleString();
            return (
              <div className="ml-2 flex w-[180px] items-center sm:ml-0 sm:w-[150px]">
                <span>{started}</span>
              </div>
            );
          },
        },
        {
          accessorKey: "end_time",
          header: () => (
            <FilterControls.SortHeader
              id="end_time"
              label="End time"
              value={sortQueryParams}
              onChange={setSortQueryParams}
            />
          ),
          cell: ({ row }) => {
            const startTime = new Date(row.original.startTime);
            const endTime = row.original.endTime ? new Date(row.original.endTime) : null;
            const isOngoing = !endTime || endTime < startTime;
            return (
              <div className="ml-2 flex w-[180px] items-center sm:ml-0 sm:w-[150px]">
                <span>{isOngoing ? "Ongoing" : endTime?.toLocaleString()}</span>
              </div>
            );
          },
        },
        {
          accessorKey: "duration",
          header: () => (
            <FilterControls.SortHeader
              id="duration"
              label="Duration"
              value={sortQueryParams}
              onChange={setSortQueryParams}
            />
          ),
          cell: ({ row }) => {
            let durationSec = row.original.downtimeDurationSeconds || 0;
            if (durationSec === 0) {
              const now = Date.now();
              const start = new Date(row.original.startTime).getTime();
              durationSec = Math.floor((now - start) / 1000);
            }
            return (
              <div className="ml-2 flex w-[180px] items-center sm:ml-0 sm:w-[100px]">
                <span>{formatDuration(durationSec)}</span>
              </div>
            );
          },
        },
      ];
      return cols;
    },
    [showLastStatus, sortQueryParams, setSortQueryParams]
  );

  const table = useReactTable<IncidentTree>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <ScrollArea className="w-full">
      <Table className="text-sm">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="px-4 py-2 hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="font-bold text-medium-emphasis">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className="text-medium-emphasis"
                isHoverable
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={table.getAllColumns().length}
                className="h-24 text-center text-muted-foreground"
              >
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {(totalCount > pageSize) && (
        <div className="mt-5 flex items-center justify-end">
          <Pagination
            page={pageNumber as number}
            pageSize={pageSize as number}
            pageSizeOptions={[pageSize as number]}
            onChange={handlePageChange}
            totalCount={totalCount || 0}
          />
        </div>
      )}

      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const units = [
    { value: days, label: "d" },
    { value: hours, label: "h" },
    { value: minutes, label: "m" },
    { value: secs, label: "s" },
  ];

  const nonZero = units.filter((u) => u.value > 0);
  if (!nonZero.length) return "0s";

  return nonZero.slice(0, 2).map((u) => `${u.value}${u.label}`).join(" ");
}

export default IncidentList;
