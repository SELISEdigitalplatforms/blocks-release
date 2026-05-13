import React, { useState, useMemo } from "react";
import { Search, ExternalLink, RefreshCw } from "lucide-react";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { SortHeader } from "@/components/filter-toolbar/sort-header/sort-header";

interface Vulnerability {
  id: string;
  name: string;
  cwe: string;
  date: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Informational";
}

interface DASTSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  informational: number;
  total: number;
}

interface DASTCardProps {
  title: string;
  summary: DASTSummary;
  vulnerabilities: Vulnerability[];
}

export const useVulnerabilityFilterQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    page: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
    "selected-filter": parseAsString.withDefault("name"),
    name: parseAsString.withDefault(""),
    cwe: parseAsString.withDefault(""),
  });
  return { queryParams, setQueryParams };
};

export const useVulnerabilitySortQueryParams = () => {
  const [sortQueryParams, setSortQueryParams] = useState({
    property: "name",
    isDescending: false,
  });
  return { sortQueryParams, setSortQueryParams };
};

const VulnerabilityFilterToolbar = () => {
  const { queryParams, setQueryParams } = useVulnerabilityFilterQueryParams();

  return (
    <div className="px-6 py-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
        <input
          type="text"
          placeholder="Search vulnerabilities..."
          value={queryParams["selected-filter"] === "name" ? queryParams.name : queryParams.cwe}
          onChange={(e) => {
            const value = e.target.value;
            setQueryParams((params) => ({
              ...params,
              [queryParams["selected-filter"]]: value,
              page: 0,
            }));
          }}
          className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="grid w-full gap-2 p-6">
    {Array.from({ length: 10 }).map((_, index) => (
      <Skeleton key={index} className="h-12 w-full rounded-lg" />
    ))}
  </div>
);

const Badge = ({
  children,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  variant?: string;
  className?: string;
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case "critical":
        return "bg-red-100 text-red-700 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-700 border-green-200";
      case "informational":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${getVariantStyles()} ${className}`}
    >
      {children}
    </span>
  );
};

const VulnerabilitiesTable = ({
  vulnerabilities,
  isLoading,
}: {
  vulnerabilities: Vulnerability[];
  isLoading: boolean;
}) => {
  const { queryParams } = useVulnerabilityFilterQueryParams();
  const { sortQueryParams, setSortQueryParams } = useVulnerabilitySortQueryParams();

  const columns = useMemo<ColumnDef<Vulnerability>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: () => (
          <SortHeader
            id="name"
            label="Name"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: (info) => (
          <button className="text-left text-sm font-medium text-blue-600 hover:text-blue-800">
            {info.getValue() as string}
          </button>
        ),
      },
      {
        id: "cwe",
        accessorKey: "cwe",
        header: () => (
          <SortHeader id="cwe" label="CWE" value={sortQueryParams} onChange={setSortQueryParams} />
        ),
        cell: (info) => (
          <div className="flex items-center gap-2">
            <button className="text-sm font-medium text-blue-600 hover:text-blue-800">
              {info.getValue() as string}
            </button>
            <ExternalLink className="h-3 w-3 text-gray-400" />
          </div>
        ),
      },
      {
        id: "date",
        accessorKey: "date",
        header: () => (
          <SortHeader
            id="date"
            label="Date"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: (info) => <div className="text-sm text-gray-900">{info.getValue() as string}</div>,
      },
      {
        id: "severity",
        accessorKey: "severity",
        header: () => (
          <SortHeader
            id="severity"
            label="Security"
            value={sortQueryParams}
            onChange={setSortQueryParams}
          />
        ),
        cell: (info) => {
          const severity = info.getValue() as string;
          const severityVariantMap: Record<
            string,
            "error" | "destructive" | "success" | "info" | "default"
          > = {
            critical: "error",
            high: "destructive",
            medium: "default",
            low: "success",
            informational: "info",
          };
          const variant = severityVariantMap[severity.toLowerCase()] ?? "default";
          return <Badge variant={variant}>{severity}</Badge>;
        },
      },
    ],
    [sortQueryParams, setSortQueryParams],
  );

  const filteredData = useMemo(() => {
    return vulnerabilities.filter((vuln) => {
      const searchTerm =
        queryParams["selected-filter"] === "name" ? queryParams.name : queryParams.cwe;

      if (!searchTerm) return true;

      const field = queryParams["selected-filter"] === "name" ? vuln.name : vuln.cwe;
      return field.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [vulnerabilities, queryParams]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: {
        pageIndex: queryParams.page,
        pageSize: queryParams.pageSize,
      },
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow isHoverable>
            {table
              .getHeaderGroups()
              .map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                )),
              )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {!filteredData.length ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No vulnerabilities found.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => {}}
                isHoverable
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

const SummaryCards = ({ summary }: { summary: DASTSummary }) => {
  return (
    <div className="border-b border-gray-100 px-6 py-4">
      <div className="grid grid-cols-6 gap-4">
        <div className="border-l-4 border-red-500 pl-3">
          <div className="mb-1 text-xs font-medium text-gray-600">Critical</div>
          <div className="text-2xl font-bold text-gray-900">{summary.critical}</div>
        </div>
        <div className="border-l-4 border-orange-500 pl-3">
          <div className="mb-1 text-xs font-medium text-gray-600">High</div>
          <div className="text-2xl font-bold text-gray-900">{summary.high}</div>
        </div>
        <div className="border-l-4 border-yellow-500 pl-3">
          <div className="mb-1 text-xs font-medium text-gray-600">Medium</div>
          <div className="text-2xl font-bold text-gray-900">{summary.medium}</div>
        </div>
        <div className="border-l-4 border-green-500 pl-3">
          <div className="mb-1 text-xs font-medium text-gray-600">Low</div>
          <div className="text-2xl font-bold text-gray-900">{summary.low}</div>
        </div>
        <div className="border-l-4 border-blue-500 pl-3">
          <div className="mb-1 text-xs font-medium text-gray-600">Informational</div>
          <div className="text-2xl font-bold text-gray-900">{summary.informational}</div>
        </div>
        <div className="border-l-4 border-gray-900 pl-3">
          <div className="mb-1 text-xs font-medium text-gray-600">Total</div>
          <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
        </div>
      </div>
    </div>
  );
};

// Pagination Component for Observability tables
const PaginationComponent = () => {
  const { queryParams, setQueryParams } = useVulnerabilityFilterQueryParams();

  const handlePageChange = (newPage: number) => {
    setQueryParams((params) => ({ ...params, page: newPage }));
  };

  const totalPages = 5;
  const currentPage = queryParams.page;

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Showing {currentPage * queryParams.pageSize + 1}-
          {Math.min((currentPage + 1) * queryParams.pageSize, 193)} of 193 entries
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePageChange(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          {[...Array(Math.min(5, totalPages))].map((_, i) => (
            <button
              key={i}
              onClick={() => handlePageChange(i)}
              className={`rounded px-3 py-2 text-xs font-medium ${
                currentPage === i ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => handlePageChange(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
            className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

const DASTCard: React.FC<DASTCardProps> = ({ title, summary, vulnerabilities }) => {
  const [isLoading] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900">
            <ExternalLink className="h-4 w-4" />
            View in DefectDojo
          </button>
        </div>

        <div className="mt-3 flex items-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <span>Last scan:</span>
            <span className="font-medium text-gray-700">19/02/2024 at 15:32:41</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Scan type:</span>
            <span className="font-medium text-gray-700">OWASP ZAP Full Scan</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Target URL:</span>
            <span className="font-medium text-gray-700">https://app.example.com</span>
            <RefreshCw className="h-3 w-3 text-gray-400" />
          </div>
        </div>
      </div>

      <SummaryCards summary={summary} />

      <VulnerabilityFilterToolbar />

      <VulnerabilitiesTable vulnerabilities={vulnerabilities} isLoading={isLoading} />

      <PaginationComponent />
    </div>
  );
};

const DASTTab: React.FC = () => {
  const dastSummary = {
    critical: 1,
    high: 18,
    medium: 26,
    low: 60,
    informational: 88,
    total: 193,
  };

  const dastVulnerabilities: Vulnerability[] = [
    {
      id: "1",
      name: "SQL Injection",
      cwe: "89",
      date: "19/02/2024",
      severity: "Critical",
    },
    {
      id: "2",
      name: "Hidden File Found",
      cwe: "26",
      date: "19/02/2024",
      severity: "High",
    },
    {
      id: "3",
      name: "Content Security Policy (CSP) Header Not Set",
      cwe: "112",
      date: "19/02/2024",
      severity: "High",
    },
    {
      id: "4",
      name: "Cross-Domain Misconfiguration",
      cwe: "855",
      date: "19/02/2024",
      severity: "High",
    },
    {
      id: "5",
      name: "Cross-Domain Misconfiguration",
      cwe: "672",
      date: "19/02/2024",
      severity: "High",
    },
    {
      id: "6",
      name: "Content Security Policy (CSP) Header Not Set",
      cwe: "91",
      date: "19/02/2024",
      severity: "High",
    },
    {
      id: "7",
      name: "Missing Anti Click jacking Header",
      cwe: "73",
      date: "19/02/2024",
      severity: "High",
    },
    {
      id: "8",
      name: "Content Security Policy (CSP) Header Not Set",
      cwe: "528",
      date: "19/02/2024",
      severity: "High",
    },
    {
      id: "9",
      name: "Content Security Policy (CSP) Header Not Set",
      cwe: "34",
      date: "19/02/2024",
      severity: "High",
    },
    {
      id: "10",
      name: "Cross-Domain Misconfiguration",
      cwe: "47",
      date: "19/02/2024",
      severity: "High",
    },
  ];

  return (
    <div className="min-h-screen w-full space-y-6 bg-gray-100 pr-6">
      <DASTCard
        title="Overview of metrics"
        summary={dastSummary}
        vulnerabilities={dastVulnerabilities}
      />
    </div>
  );
};

export default DASTTab;
