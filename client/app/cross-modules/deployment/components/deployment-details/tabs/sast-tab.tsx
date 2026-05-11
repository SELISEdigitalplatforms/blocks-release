import { Separator } from "@/components/ui-kits/separator/separator";
import {
  useGetSASTData,
  useSASTRedirectLink,
} from "@blocks-deployment/hooks/observability";
import { AlertTriangle, ExternalLink, Shield, Clock } from "lucide-react";
import { useParams } from "react-router-dom";
import React, { useMemo } from "react";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { getDeploymentLogEventBadgeClassName } from "@blocks-deployment/utils/deployment-logs.utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui-kits/card/card";
import { Button } from "@/components/ui-kits/button/button";
import { showErrorToast } from "@/hooks/use-toast";

interface StatItem {
  title: string;
  value: string;
  subtitle?: string;
  grade: string;
}

interface OverviewStatsProps {
  stats: StatItem[];
  gradeStatusView: (
    grade: string,
    title: string,
    value: string,
  ) => React.ReactNode;
  title?: string;
  description?: string;
  gridColumns?: string;
  className?: string;
}

const OverviewStats = ({
  stats,
  gradeStatusView,
  title,
  description,
  gridColumns = "grid-cols-2 md:grid-cols-3",
  className = "",
}: OverviewStatsProps) => {
  return (
    <div className={`w-full space-y-4 ${className}`}>
      {title && <p className="text-lg font-semibold">{title}</p>}
      {description && (
        <p className="text-sm text-medium-emphasis">{description}</p>
      )}

      <div className={`grid w-full gap-x-10 gap-y-2 ${gridColumns}`}>
        {stats.map((item, index) => (
          <div key={index} className="flex h-20 items-start gap-4">
            <div className="flex-1">
              <p className="text-sm text-high-emphasis">{item.title}</p>
              <p className="text-lg font-semibold">{item.value}</p>
              {item.subtitle && (
                <p className="text-xs text-gray-400">{item.subtitle}</p>
              )}
            </div>
            {item.grade && gradeStatusView(item.grade, item.title, item.value)}
          </div>
        ))}
      </div>
    </div>
  );
};

// Moved outside the component
const getOverviewData = (details: any) => [
  {
    name: "Quality Gate",
    id: "quality_gate",
    value: details?.alert_status === "OK" ? "Passed" : "Failed",
  },
  {
    name: "Lines of code",
    id: "linesOfCode",
    value: details?.ncloc ? Number(details.ncloc).toLocaleString() : "-",
  },
  // { name: "Version", id: "version", value: "1.0.0" },
  // { name: "Last", id: "last", value: "1 day ago" },
];

// Moved outside the component
const getOverallStats = (details: any): StatItem[] => {
  if (!details) return [];

  return [
    {
      title: "Security",
      value: details?.software_quality_security_issues ?? "0",
      subtitle: "Open issues",
      grade:
        details?.software_quality_security_rating === "1.0" ? "A" : "alert",
    },
    {
      title: "Reliability",
      value: details?.software_quality_reliability_issues ?? "0",
      subtitle: "Open issues",
      grade:
        details?.software_quality_reliability_rating === "1.0" ? "A" : "alert",
    },
    {
      title: "Maintainability",
      value: details?.sqale_rating ?? "0",
      subtitle: "Open issues",
      grade: details?.sqale_rating === "1.0" ? "A" : "alert",
    },
    {
      title: "Accepted issues",
      value: details?.accepted_issues ?? "0",
      subtitle: "Valid issues that were not fixed",
      grade: Number(details?.accepted_issues) > 0 ? "alert" : "A",
    },
    {
      title: "Coverage",
      value: details?.coverage ? `${details.coverage}%` : "0%",
      subtitle: details?.lines_to_cover
        ? `On ${Number(details.lines_to_cover).toLocaleString()} lines to cover`
        : "",
      grade: "chart",
    },
    {
      title: "Duplications",
      value: details?.duplicated_lines_density
        ? `${details.duplicated_lines_density}%`
        : "0%",
      subtitle: details?.ncloc
        ? `On ${Number(details.duplicated_lines).toLocaleString()} lines`
        : "",
      grade: "chart-dot",
    },
    {
      title: "Security hotspots",
      value: details?.security_hotspots ?? "0",
      subtitle: "",
      grade: "A",
    },
    {
      title: "Bugs",
      value: details?.bugs ?? "0",
      subtitle: "",
      grade: "A",
    },
    {
      title: "Code smells",
      value: details?.code_smells ?? "0",
      subtitle: "",
      grade: "",
    },
    {
      title: "Technical debt",
      value: details?.security_hotspots ?? "0",
      subtitle: "",
      grade: "",
    },
  ];
};

// Moved outside the component
const gradeStatusView = (grade: string, title: string, value: string) => {
  const commonStyle =
    "flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold";

  if (grade === "chart" || grade === "chart-dot") {
    const percentage = Math.min(100, Math.max(0, parseFloat(value) || 0));
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="flex items-center gap-2">
        <div className="relative h-16 w-16">
          <svg className="h-full w-full" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="transparent"
              stroke="rgb(229, 229, 229)"
              strokeWidth="8"
            />
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="transparent"
              stroke="rgb(18, 65, 145)"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="butt"
              transform="rotate(-90 32 32)"
            />
          </svg>
          {grade === "chart-dot" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="h-4 w-4 rounded-full bg-primary"></span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const numericValue = parseFloat(value);
  if (!isNaN(numericValue)) {
    if (numericValue < 5) {
      return (
        <div className="flex items-center gap-2">
          <span className={`${commonStyle} bg-green-100 text-green-700`}>
            A
          </span>
        </div>
      );
    } else if (numericValue < 20) {
      return (
        <div className="flex items-center gap-2">
          <span className={`${commonStyle} bg-yellow-100 text-yellow-700`}>
            <AlertTriangle size={20} />
          </span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2">
          <span className={`${commonStyle} bg-red-100 text-red-700`}>E</span>
        </div>
      );
    }
  }
  return null;
};

const SastTab = () => {
  const params = useParams();
  const buildId = params?.buildId as string;
  const { data: sastData, isLoading, error } = useGetSASTData(buildId);
  const { isLoading: isSASTLoading, refetch: triggerSASTRedirect } =
    useSASTRedirectLink(buildId);

  let details: any = undefined;
  const sastDataAny = sastData as any;
  if (
    sastDataAny &&
    typeof sastDataAny === "object" &&
    "data" in sastDataAny &&
    sastDataAny.data &&
    typeof sastDataAny.data === "object" &&
    "details" in sastDataAny.data
  ) {
    details = sastDataAny.data.details;
  }

  // Use the external functions
  const overviewData = useMemo(() => getOverviewData(details), [details]);
  const overallStats = useMemo(() => getOverallStats(details), [details]);

  const handleSASTRedirect = () => {
    const sastLink = "https://code.selise.biz";

    triggerSASTRedirect().catch(() => {
      showErrorToast({ errors: "Something went wrong" });
    });

    setTimeout(() => {
      window.open(sastLink, "_blank");
    }, 1000);
  };

  return (
    <div className="min-h-screen w-full space-y-6">
      {isLoading ? (
        <>
          {/* Skeleton for SAST Overview */}
          <Card>
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <Skeleton className="mb-2 h-6 w-48" />
                <Skeleton className="h-8 w-40" />
              </div>
              <div className="mt-3 flex items-center gap-6 text-xs text-gray-500">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <div className="p-6">
              <Skeleton className="mb-4 h-8 w-64" />
              <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </Card>
        </>
      ) : !error && details ? (
        <Card>
          <CardHeader className="mb-0 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle>Overview</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSASTRedirect}
                disabled={isSASTLoading}>
                <ExternalLink className="mr-2 h-4 w-4" />
                View in SonarQube
              </Button>
            </div>

            <div className="flex gap-2 text-xs">
              {overviewData.map((item, index) => (
                <div key={index}>
                  <span className="text-low-emphasis">{item.name}</span>
                  <span
                    className={
                      item.name === "Quality Gate"
                        ? `${getDeploymentLogEventBadgeClassName(item.value)} ml-2`
                        : `pl-2`
                    }>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <Separator orientation="horizontal" className="my-4 w-full" />
            <OverviewStats
              stats={overallStats}
              gradeStatusView={gradeStatusView}
              title="Overall code"
              gridColumns="grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
            />
          </CardContent>
        </Card>
      ) : !error && !details ? (
        <Card className="w-full">
          <CardHeader className="pb-4 text-center">
            <div className="mb-4 flex justify-center">
              <div className="relative">
                <Shield className="h-16 w-16 text-muted-foreground" />
                <Clock className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background p-1 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-2xl">
              Static Application Security Testing
            </CardTitle>
            <CardDescription className="text-lg">
              Data Processing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              The SAST data is still being processed. Please check back later.
            </p>

            <div className="pt-4">
              <div className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                <Clock className="mr-1 h-3 w-3" />
                Analysis in progress
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full">
          <CardHeader className="pb-4 text-center">
            <div className="mb-4 flex justify-center">
              <div className="relative">
                <Shield className="h-16 w-16 text-muted-foreground" />
                <AlertTriangle className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background p-1 text-red-600" />
              </div>
            </div>
            <CardTitle className="text-2xl">
              Static Application Security Testing
            </CardTitle>
            <CardDescription className="text-lg">
              Error Loading Data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              There was an error loading the SAST data. Please try again later.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SastTab;
