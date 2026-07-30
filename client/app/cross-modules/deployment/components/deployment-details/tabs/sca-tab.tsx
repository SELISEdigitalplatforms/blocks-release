import React, { useState, useMemo } from "react";
import { Search, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { SortHeader } from "@/components/filter-toolbar/sort-header/sort-header";
import {
  useGetSCALibraryData,
  useSCARedirectLink,
} from "@/cross-modules/deployment/hooks/use-observability";
import { useParams } from "react-router";
import { Button } from "@/components/ui-kits/button/button";
import { ErrorDisplay } from "@/components/error-display";

interface Dependency {
  id: string;
  group: string;
  component: string;
  version: string;
  vulnerability: string;
  cvss: number | null;
  epss: number;
  severity: "Critical" | "High" | "Medium" | "Low" | "Unassigned";
  source?: string;
  cweName?: string;
  description?: string;
  name?: string;
  epssScore?: number;
  latestVersion?: string;
}

interface SCASummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  unassigned: number;
  riskScore: number;
  vulnerabilities: string;
  vulnerableComponents: string;
  components: string;
}

interface SCACardProps {
  title: string;
  summary: SCASummary;
  dependencies: Dependency[];
  lastBOMImport?: string;
  lastVulnAnalysis?: string;
  lastMeasurement?: string;
}

interface FilterState {
  page: number;
  pageSize: number;
  selectedFilter: "component" | "vulnerability";
  component: string;
  vulnerability: string;
  previousPage: number; // Track previous page for restoration
  severityFilter: "Critical" | "High" | "Medium" | "Low" | "Unassigned" | null;
}

interface SortState {
  property: string;
  isDescending: boolean;
}

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
      case "unassigned":
        return "bg-gray-100 text-medium-emphasis border-transition";
      default:
        return "bg-gray-100 text-medium-emphasis border-transition";
    }
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${getVariantStyles()} ${className}`}>
      {children}
    </span>
  );
};

const DependencyFilterToolbar = ({
  filterState,
  setFilterState,
}: {
  filterState: FilterState;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
}) => {
  return (
    <div className="relative my-5 max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-low-emphasis" />
      <input
        type="text"
        placeholder="Search dependencies..."
        value={
          filterState.selectedFilter === "component"
            ? filterState.component
            : filterState.vulnerability
        }
        onChange={(e) => {
          const value = e.target.value;
          setFilterState((prev) => {
            // If we're starting a new search, save current page
            const currentSearchTerm =
              prev.selectedFilter === "component"
                ? prev.component
                : prev.vulnerability;
            const isStartingSearch = !currentSearchTerm && value;
            const isClearingSearch = currentSearchTerm && !value;

            return {
              ...prev,
              [prev.selectedFilter]: value,
              page: isStartingSearch
                ? 0
                : isClearingSearch
                  ? prev.previousPage
                  : prev.page,
              previousPage: isStartingSearch ? prev.page : prev.previousPage,
            };
          });
        }}
        className="w-full rounded-md border py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="grid w-full gap-2 p-6">
    {Array.from({ length: 5 }).map((_, index) => (
      <Skeleton key={index} className="h-12 w-full rounded-lg" />
    ))}
  </div>
);

const DependenciesTable = ({
  dependencies,
  isLoading,
  filterState,
  sortState,
  setSortState,
}: {
  dependencies: Dependency[];
  isLoading: boolean;
  filterState: FilterState;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
  sortState: SortState;
  setSortState: React.Dispatch<React.SetStateAction<SortState>>;
}) => {
  const [selectedDependency, setSelectedDependency] =
    useState<Dependency | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const columns = useMemo<ColumnDef<Dependency>[]>(
    () => [
      {
        id: "component",
        accessorKey: "component",
        header: () => (
          <SortHeader
            id="component"
            label="Component"
            value={sortState}
            onChange={setSortState}
          />
        ),
        cell: (info) => (
          <button className="text-left text-sm font-medium text-blue-600 hover:text-blue-800">
            {info.getValue() as string}
          </button>
        ),
      },
      {
        id: "group",
        accessorKey: "group",
        header: () => (
          <SortHeader
            id="group"
            label="Package"
            value={sortState}
            onChange={setSortState}
          />
        ),
        cell: (info) => (
          <div className="text-sm font-medium text-medium-emphasis">
            {info.getValue() as string}
          </div>
        ),
      },
      {
        id: "version",
        accessorKey: "version",
        header: () => (
          <SortHeader
            id="version"
            label="Version"
            value={sortState}
            onChange={setSortState}
          />
        ),
        cell: (info) => (
          <div className="text-sm text-high-emphasis">
            {info.getValue() as string}
          </div>
        ),
      },
      {
        id: "vulnerability",
        accessorKey: "vulnerability",
        header: () => (
          <SortHeader
            id="vulnerability"
            label="Vulnerability"
            value={sortState}
            onChange={setSortState}
          />
        ),
        cell: (info) => (
          <div className="flex items-center gap-2">
            <span className="rounded bg-gray-100 px-2 py-1 text-xs text-low-emphasis">
              {info.row.original.source || "NVD"}
            </span>
            <a
              href={`https://nvd.nist.gov/vuln/detail/${info.getValue() as string}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-blue-600 hover:text-blue-800">
              {info.getValue() as string}
            </a>
          </div>
        ),
      },
      {
        id: "cvss",
        accessorKey: "cvss",
        header: () => (
          <SortHeader
            id="cvss"
            label="CVSS"
            value={sortState}
            onChange={setSortState}
          />
        ),
        cell: (info) => {
          const cvss = info.getValue() as number | null;
          const severity = info.row.original.severity;
          const severityVariantMap: Record<string, string> = {
            critical: "critical",
            high: "high",
            medium: "medium",
            low: "low",
            unassigned: "unassigned",
          };
          const variant =
            severityVariantMap[severity.toLowerCase()] ?? "default";

          return (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-high-emphasis">
                {cvss !== null ? cvss : "N/A"}
              </span>
              <Badge variant={variant}>{severity}</Badge>
            </div>
          );
        },
      },
      {
        id: "epss",
        accessorKey: "epss",
        header: () => (
          <SortHeader
            id="epss"
            label="EPSS %"
            value={sortState}
            onChange={setSortState}
          />
        ),
        cell: (info) => {
          const epss = info.getValue() as number;
          return (
            <div className="text-sm font-medium text-medium-emphasis">
              {epss !== null && epss !== undefined
                ? `${epss.toFixed(2)}%`
                : "N/A"}
            </div>
          );
        },
      },
    ],
    [sortState, setSortState],
  );

  const filteredData = useMemo(() => {
    return dependencies.filter((dep) => {
      const searchTerm =
        filterState.selectedFilter === "component"
          ? filterState.component
          : filterState.vulnerability;

      if (!searchTerm) return true;

      const field =
        filterState.selectedFilter === "component"
          ? dep.component
          : dep.vulnerability;
      return field.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [dependencies, filterState]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    manualPagination: true,
    pageCount: Math.ceil(filteredData.length / filterState.pageSize),
    state: {
      pagination: {
        pageIndex: filterState.page,
        pageSize: filterState.pageSize,
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
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
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
                className="h-24 text-center text-muted-foreground">
                No dependencies found.
              </TableCell>
            </TableRow>
          ) : (
            filteredData
              .slice(
                filterState.page * filterState.pageSize,
                (filterState.page + 1) * filterState.pageSize,
              )
              .map((dep) => (
                <TableRow
                  key={dep.id}
                  className="cursor-pointer hover:bg-secondary"
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target && target.closest("a")) {
                      return;
                    }
                    setSelectedDependency(dep);
                    setIsDialogOpen(true);
                  }}
                  isHoverable>
                  <TableCell>
                    <button className="text-left text-sm font-medium text-blue-600 hover:text-blue-800">
                      {dep.component}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-medium-emphasis">
                      {dep.group}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-high-emphasis">
                      {dep.version}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-gray-100 px-2 py-1 text-xs text-low-emphasis">
                        {dep.source || "NVD"}
                      </span>
                      <a
                        href={`https://nvd.nist.gov/vuln/detail/${dep.vulnerability}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800">
                        {dep.vulnerability}
                      </a>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-high-emphasis">
                        {dep.cvss !== null ? dep.cvss : "N/A"}
                      </span>
                      <Badge variant={dep.severity.toLowerCase()}>
                        {dep.severity}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-medium-emphasis">
                      {dep.epss !== null && dep.epss !== undefined
                        ? `${dep.epss.toFixed(2)}%`
                        : "N/A"}
                    </div>
                  </TableCell>
                </TableRow>
              ))
          )}
        </TableBody>
      </Table>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader className="p-2">
            {/* <DialogTitle>{selectedDependency?.cweName || "Vulnerability details"}</DialogTitle> */}
            <DialogTitle>Vulnerability details</DialogTitle>
            <DialogDescription className="py-4">
              {/* {selectedDependency?.description || "No description available."} */}
              <div className="text-sm font-bold text-muted-foreground">
                Name
              </div>
              <div className="text-sm">
                {selectedDependency?.name || "No name available."}
              </div>

              <div className="mt-2 text-sm font-bold text-muted-foreground">
                Group
              </div>
              <div className="text-sm">
                {selectedDependency?.group || "No group available."}
              </div>

              <div className="mt-2 text-sm font-bold text-muted-foreground">
                Version
              </div>
              <div className="text-sm">
                {selectedDependency?.version || "No version available."}
              </div>

              <div className="mt-2 text-sm font-bold text-muted-foreground">
                Latest Version
              </div>
              <div className="text-sm">
                {selectedDependency?.latestVersion || "No data available."}
              </div>

              <div className="mt-2 text-sm font-bold text-muted-foreground">
                Source
              </div>
              <div className="text-sm">
                {selectedDependency?.source || "No source available."}
              </div>

              <div className="mt-2 text-sm font-bold text-muted-foreground">
                CVSS
              </div>
              <div className="text-sm">
                {selectedDependency?.cvss || "No CVSS available."}
              </div>

              <div className="mt-2 text-sm font-bold text-muted-foreground">
                EPSS Percentile
              </div>
              <div className="text-sm">
                {selectedDependency?.epss || "No EPSS available."}
              </div>

              <div className="mt-2 text-sm font-bold text-muted-foreground">
                EPSS Score
              </div>
              <div className="text-sm">
                {selectedDependency?.epssScore || "No EPSS Score available."}
              </div>

              <div className="mt-2 text-sm font-bold text-muted-foreground">
                CWE Name
              </div>
              <div className="text-sm">
                {selectedDependency?.cweName || "No CWE Name available."}
              </div>

              <div className="mt-2 text-sm font-bold text-muted-foreground">
                Description
              </div>
              <div className="text-sm">
                {selectedDependency?.description || "No description available."}
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const SummaryCards = ({
  summary,
  onSeverityClick,
  activeSeverityFilter,
}: {
  summary: SCASummary;
  onSeverityClick?: (
    severity: "Critical" | "High" | "Medium" | "Low" | "Unassigned" | null,
  ) => void;
  activeSeverityFilter?:
    | "Critical"
    | "High"
    | "Medium"
    | "Low"
    | "Unassigned"
    | null;
}) => {
  return (
    <div className="border-b pb-5 transition-colors">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-6">
        <div className="border-l-4 border-red-800 pl-2 sm:pl-3">
          <div className="mb-1 text-xs font-medium text-high-emphasis">
            Total vulnerabilities
          </div>
          <div className="text-xl font-bold sm:text-2xl">
            {summary.vulnerabilities}
          </div>
        </div>

        <button
          type="button"
          className={`w-full cursor-pointer border-l-4 border-red-500 pl-2 text-left transition-colors hover:bg-red-50 sm:pl-3 ${
            activeSeverityFilter === "Critical" ? "bg-red-50" : ""
          }`}
          onClick={() => onSeverityClick?.("Critical")}>
          <span className="mb-1 block text-xs font-medium text-high-emphasis">
            Critical
          </span>
          <span className="block text-xl font-bold sm:text-2xl">
            {summary.critical}
          </span>
        </button>

        <button
          type="button"
          className={`w-full cursor-pointer border-l-4 border-orange-500 pl-2 text-left transition-colors hover:bg-orange-50 sm:pl-3 ${
            activeSeverityFilter === "High" ? "bg-orange-50" : ""
          }`}
          onClick={() => onSeverityClick?.("High")}>
          <span className="mb-1 block text-xs font-medium text-high-emphasis">
            High
          </span>
          <span className="block text-xl font-bold sm:text-2xl">
            {summary.high}
          </span>
        </button>

        <button
          type="button"
          className={`w-full cursor-pointer border-l-4 border-yellow-500 pl-2 text-left transition-colors hover:bg-yellow-50 sm:pl-3 ${
            activeSeverityFilter === "Medium" ? "bg-yellow-50" : ""
          }`}
          onClick={() => onSeverityClick?.("Medium")}>
          <span className="mb-1 block text-xs font-medium text-high-emphasis">
            Medium
          </span>
          <span className="block text-xl font-bold sm:text-2xl">
            {summary.medium}
          </span>
        </button>

        <button
          type="button"
          className={`w-full cursor-pointer border-l-4 border-green-500 pl-2 text-left transition-colors hover:bg-green-50 sm:pl-3 ${
            activeSeverityFilter === "Low" ? "bg-green-50" : ""
          }`}
          onClick={() => onSeverityClick?.("Low")}>
          <span className="mb-1 block text-xs font-medium text-high-emphasis">
            Low
          </span>
          <span className="block text-xl font-bold sm:text-2xl">
            {summary.low}
          </span>
        </button>

        <button
          type="button"
          className={`w-full cursor-pointer border-l-4 border-gray-500 pl-2 text-left transition-colors hover:bg-gray-50 sm:pl-3 ${
            activeSeverityFilter === "Unassigned" ? "bg-secondary" : ""
          }`}
          onClick={() => onSeverityClick?.("Unassigned")}>
          <span className="mb-1 block text-xs font-medium text-high-emphasis">
            Unassigned
          </span>
          <span className="block text-xl font-bold sm:text-2xl">
            {summary.unassigned}
          </span>
        </button>
      </div>
    </div>
  );
};

const DependencyPaginationComponent = ({
  totalItems,
  filterState,
  setFilterState,
}: {
  totalItems: number;
  filterState: FilterState;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
}) => {
  const handlePageChange = (newPage: number) => {
    setFilterState((prev) => ({ ...prev, page: newPage }));
  };

  const totalPages = Math.ceil(totalItems / filterState.pageSize);
  const currentPage = filterState.page;

  // Generate page numbers to show (current page and next 2 pages)
  const getPageNumbers = () => {
    const pages = [];

    // Always show current page and next 2 pages
    for (let i = currentPage; i < Math.min(currentPage + 3, totalPages); i++) {
      pages.push(i);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="border-transition border-t bg-background px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-low-emphasis">
          Showing {currentPage * filterState.pageSize + 1}-
          {Math.min((currentPage + 1) * filterState.pageSize, totalItems)} of{" "}
          {totalItems} entries
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handlePageChange(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="px-3 py-2 text-xs text-low-emphasis hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">
            Previous
          </button>

          {pageNumbers.map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => handlePageChange(pageNum)}
              className={`rounded px-3 py-2 text-xs font-medium ${
                currentPage === pageNum
                  ? "bg-accent text-primary"
                  : "text-low-emphasis hover:text-medium-emphasis"
              }`}>
              {pageNum + 1}
            </button>
          ))}

          {/* Show ellipsis and last page if not already showing */}
          {totalPages > 3 && !pageNumbers.includes(totalPages - 1) && (
            <>
              <span className="px-2 text-xs text-gray-400">...</span>
              <button
                onClick={() => handlePageChange(totalPages - 1)}
                className="px-3 py-2 text-xs text-low-emphasis hover:text-primary">
                {totalPages}
              </button>
            </>
          )}

          <button
            onClick={() =>
              handlePageChange(Math.min(totalPages - 1, currentPage + 1))
            }
            disabled={currentPage === totalPages - 1}
            className="px-3 py-2 text-xs text-low-emphasis hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

const SCACard: React.FC<SCACardProps> = ({ title, summary, dependencies }) => {
  const params = useParams();
  const buildId = params?.buildId as string;

  const { isLoading: isSCALoading, refetch: triggerSCARedirect } =
    useSCARedirectLink(buildId);

  const [filterState, setFilterState] = useState<FilterState>({
    page: 0,
    pageSize: 5,
    selectedFilter: "component",
    component: "",
    vulnerability: "",
    previousPage: 0,
    severityFilter: null,
  });

  const [sortState, setSortState] = useState<SortState>({
    property: "component",
    isDescending: false,
  });

  const filteredDependencies = useMemo(() => {
    let filtered = dependencies;

    // Apply severity filter first
    if (filterState.severityFilter) {
      filtered = filtered.filter(
        (dep) => dep.severity === filterState.severityFilter,
      );
    }

    // Apply search filter
    const searchTerm =
      filterState.selectedFilter === "component"
        ? filterState.component
        : filterState.vulnerability;

    if (searchTerm) {
      filtered = filtered.filter((dep) => {
        const field =
          filterState.selectedFilter === "component"
            ? dep.component
            : dep.vulnerability;
        return field.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    return filtered;
  }, [dependencies, filterState]);

  const handleSeverityClick = (
    severity: "Critical" | "High" | "Medium" | "Low" | "Unassigned" | null,
  ) => {
    setFilterState((prev) => {
      const isClearingFilter = prev.severityFilter === severity;
      const isSettingNewFilter =
        prev.severityFilter !== severity && severity !== null;

      return {
        ...prev,
        severityFilter: isClearingFilter ? null : severity,
        page: isSettingNewFilter ? 0 : prev.page, // Only reset to page 0 when setting a new filter, not when clearing
      };
    });
  };

  const handleSCARedirect = async () => {
    try {
      await triggerSCARedirect();

      const scaLink =
        process.env.NEXT_PUBLIC_SCA_PORTAL_LINK ||
        "https://sca.seliseblocks.com";
      window.open(scaLink, "_blank");
    } catch (error) {
      console.error("Failed to redirect to SCA:", error);
    }
  };

  return (
    <Card>
      {/* Header Section */}

      <CardHeader className="flex flex-col gap-5">
        <div className="flex justify-between">
          <CardTitle className="flex items-center">{title}</CardTitle>
          <Button
            variant={"outline"}
            onClick={handleSCARedirect}
            disabled={isSCALoading}
            className="flex gap-2">
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">View in Dependency Track</span>
            <span className="sm:hidden">Dependency Track</span>
          </Button>
        </div>

        <div className="flex flex-col gap-3 text-xs font-medium sm:flex-row">
          <div className="flex gap-2">
            <span className="text-low-emphasis">Total components:</span>
            <span className="font-semibold">{summary?.components}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-low-emphasis">Vulnerable components:</span>
            <span className="font-semibold">
              {summary?.vulnerableComponents}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-low-emphasis">Risk Score:</span>
            <span className="font-semibold">{summary?.riskScore}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <SummaryCards
          summary={summary}
          onSeverityClick={handleSeverityClick}
          activeSeverityFilter={filterState.severityFilter}
        />

        <DependencyFilterToolbar
          filterState={filterState}
          setFilterState={setFilterState}
        />

        <DependenciesTable
          dependencies={filteredDependencies}
          isLoading={false}
          filterState={filterState}
          setFilterState={setFilterState}
          sortState={sortState}
          setSortState={setSortState}
        />

        <DependencyPaginationComponent
          totalItems={filteredDependencies.length}
          filterState={filterState}
          setFilterState={setFilterState}
        />
      </CardContent>
    </Card>
  );
};

const SCATab: React.FC = () => {
  const params = useParams();
  const buildId = params?.buildId as string;
  const {
    data: scaData,
    isLoading,
    error,
  } = useGetSCALibraryData(buildId) as any;
  const scaDetails = scaData?.data?.details;
  const vulnerabilities = scaData?.data?.vulnerabilities || [];

  const libraryPackageSummary = {
    critical: scaDetails?.critical,
    high: scaDetails?.high,
    medium: scaDetails?.medium,
    low: scaDetails?.low,
    unassigned: scaDetails?.unassigned,
    riskScore: scaDetails?.inheritedRiskScore,
    vulnerabilities: scaDetails?.vulnerabilities,
    vulnerableComponents: scaDetails?.vulnerableComponents,
    components: scaDetails?.components,
  };

  const transformVulnerabilities = (vulnerabilities: any[]): Dependency[] => {
    if (!Array.isArray(vulnerabilities) || vulnerabilities.length === 0) {
      return [];
    }

    // Severity mapping
    const severityMap: Record<
      string,
      "Critical" | "High" | "Medium" | "Low" | "Unassigned"
    > = {
      CRITICAL: "Critical",
      HIGH: "High",
      MEDIUM: "Medium",
      LOW: "Low",
    };

    // Transform vulnerabilities
    const transformed = vulnerabilities.map((vuln: any, index: number) => ({
      id: (index + 1).toString(),
      component: vuln.name || "Unknown",
      group: vuln.group || "Unknown",
      version: vuln.version || "Unknown",
      vulnerability: vuln.id || "Unknown",
      cvss: vuln.score ? parseFloat(vuln.score) : null,
      severity: severityMap[vuln.severity] || "Unassigned",
      source: "NVD",
      epss: vuln.epssPercentile * 100 || 0,
      cweName: vuln.cweName || "Unknown",
      description: vuln.description || "No description available",
      name: vuln.name || "No name available",
      latestVersion: vuln.latestVersion || "No version available",
      epssScore: vuln.epssScore,
    }));

    // Sort by severity and CVSS score
    const severityOrder = {
      Critical: 1,
      High: 2,
      Medium: 3,
      Low: 4,
      Unassigned: 5,
    };

    const sorted = transformed.sort((a, b) => {
      const orderA = severityOrder[a.severity] || 6;
      const orderB = severityOrder[b.severity] || 6;

      // If same severity, sort by CVSS score (higher first, null last)
      if (orderA === orderB) {
        if (a.cvss === null && b.cvss === null) return 0;
        if (a.cvss === null) return 1;
        if (b.cvss === null) return -1;
        return b.cvss - a.cvss;
      }

      return orderA - orderB;
    });

    // Update IDs to reflect new order
    return sorted.map((item, index) => ({
      ...item,
      id: (index + 1).toString(),
    }));
  };

  // In your component, use the function:
  const libraryPackageDependencies: Dependency[] = useMemo(
    () => transformVulnerabilities(vulnerabilities),
    [vulnerabilities],
  );

  return (
    <div className="w-full space-y-6">
      {isLoading ? (
        <>
          {/* Skeleton for Software library package */}
          <div className="overflow-hidden rounded-lg border bg-background">
            <div className="border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <Skeleton className="mb-2 h-6 w-48" />
                <Skeleton className="h-8 w-40" />
              </div>
              <div className="mt-3 flex items-center gap-6 text-xs text-low-emphasis">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4 flex gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-24 rounded-lg" />
                ))}
              </div>
              <Skeleton className="mb-4 h-8 w-64" />
              <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </>
      ) : !error && scaDetails ? (
        <>
          <SCACard
            title="Software library package"
            summary={libraryPackageSummary}
            dependencies={libraryPackageDependencies}
          />
        </>
      ) : (
        <Card>
          <CardContent className="p-2">
            <ErrorDisplay
              text={error?.message || "Error loading SCA data"}
              className="w-full"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SCATab;
