import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { AlertTree } from "@blocks-devops/models/alerts";
import { useMemo } from "react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { FilterControls, useSortQueryParams } from "@/components/filter-toolbar";
import { ScrollArea, ScrollBar } from "@/components/ui-kits/scroll-area/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { useNavigate } from "react-router-dom";
import { useAlertFilterQueryParams } from "./alerts-filter-toolbar";
import ProgressBar from "@blocks-devops/components/add-repo/progress-bar";
import AlertAction from "@blocks-devops/components/add-repo/alert-action";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { Pagination } from "@/components/ui-kits/pagination/pagination";

type AlertsListProps = {
  data: AlertTree[];
  isLoading: boolean;
  pageNumber?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
};

export const LoadingSkelton = () => (
  <div className="grid w-full gap-2">
    {Array.from({ length: 10 }).map((_, index) => (
      <Skeleton key={index} className="h-12 w-full rounded-xl" />
    ))}
  </div>
);
export const formatSeconds = (seconds: number) => {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}min`;
  }

  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return `${hours}h`;
  }

  const days = Math.floor(seconds / 86400);
  return `${days}d`;
};
function formatDate(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  } else if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
}
const useAlertSortQueryParams = () =>
  useSortQueryParams({ initial: { property: "name", isDescending: false } });

export function AlertsList({
  data,
  isLoading,
  pageNumber,
  pageSize = 10,
  totalCount = 0,
  onPageChange,
}: AlertsListProps) {
  const navigate = useNavigate();
  const projectKey = useProjectStore()?.selectedProject?.tenantId || "";
  const { setQueryParams } = useAlertFilterQueryParams();
  const { sortQueryParams, setSortQueryParams } = useAlertSortQueryParams();

  const pageChangeHandler = (page: number) => {
    setQueryParams((params) => ({ ...params, page }));
  };
  const handlePageChange = onPageChange || pageChangeHandler;

  const columns = useMemo<ColumnDef<AlertTree>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => (
          <FilterControls.SortHeader
            id="name"
            label="Name"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: ({ row }) => {
          const name = row.original.name || row.original.operationName || "N/A";
          return (
            <div className="ml-2 flex flex-row items-center sm:ml-0 sm:w-[180px]">
              <span>{name}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "monitorType",
        header: () => (
          <FilterControls.SortHeader
            id="monitor_type"
            label="Monitor Type"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: ({ row }) => {
          const monitorType = row.original.monitorConfigurationType === 0 ? "Request" : "Callback";
          return (
            <div className="ml-2 flex w-[180px] items-center sm:ml-0 sm:w-[150px]">
              <span>{monitorType}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "url",
        header: () => (
          <FilterControls.SortHeader
            id="url"
            label="URL"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: ({ row }) => {
          const url = row.original.url || row.original.request?.url || "N/A";
          return (
            <div className="ml-2 flex w-[180px] items-center sm:ml-0 sm:w-[150px]">
              <span className="break-all">{url}</span>
            </div>
          );
        },
      },

      {
        accessorKey: "uptime",
        header: () => (
          <FilterControls.SortHeader
            id="uptime"
            label="Uptime"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: ({ row }) => {
          const { lastIncidentAt, currentStatus, createdDate } = row.original;
          const lastIncidentDateStr = lastIncidentAt ?? createdDate;
          const zeroDate = new Date("0001-01-01T00:00:00Z").getTime();
          const lastIncidentTime = new Date(lastIncidentDateStr).getTime();
          const createdTime = new Date(createdDate).getTime();
          const incidentTime = lastIncidentTime === zeroDate ? createdTime : lastIncidentTime;
          const uptime = Date.now() - incidentTime;
          const formattedDate = formatDate(uptime);

          return (
            <div className="ml-2 flex w-[180px] items-center sm:ml-0 sm:w-[150px]">
              <span>{formattedDate}</span>
              {currentStatus ? (
                <ArrowUp className="ml-1 h-4 w-4 text-green-500" />
              ) : (
                <ArrowDown className="ml-1 h-4 w-4 text-red-500" />
              )}
            </div>
          );
        },
      },

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
          const incidentList = row.original.incidentSummaries;
          const status = row.original.currentStatus;
          return (
            <div className="flex justify-start mt-3">
              <ProgressBar incidents={incidentList} status={status} />
            </div>
          );
        },
      },
      {
        accessorKey: "AlertActions",
        header: () => <div className="text-center"></div>,
        cell: ({ row }) => {
          const request = row.original.monitorConfigurationType === 0 ? true : false;
          const name = row.original.name;
          const monitorSourceType = row.original.monitorSourceTypes;
          return (
            <>
              {monitorSourceType !== 2 ? (
                <div onClick={(e) => e.stopPropagation()} className="flex justify-center">
                  <AlertAction
                    monitorId={row.original.itemId as string}
                    isActive={row.original.isActive ?? false}
                    goBack={false}
                    request={request}
                    name={name as string}
                    projectKey={projectKey}
                    monitorSourceType={monitorSourceType}
                  />
                </div>
              ) : null}
            </>
          );
        },
      },
    ],
    [setSortQueryParams, sortQueryParams, projectKey],
  );
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const handleRowClick = (itemId: string) => {
    if (itemId) {
      navigate(`/health/monitor/${itemId}`);
    }
  };
  if (isLoading) return <LoadingSkelton />;
  return (
    <>
      {" "}
      <ScrollArea className="w-full">
        <Table className="text-sm">
          {" "}
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
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="text-medium-emphasis"
                  onClick={() => handleRowClick(row.original.itemId as string)}
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
        {totalCount > pageSize && (
          <div className="mt-5 flex items-center md:justify-end">
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
    </>
  );
}
