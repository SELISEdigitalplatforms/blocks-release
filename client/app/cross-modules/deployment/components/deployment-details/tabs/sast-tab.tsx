import { Separator } from "@/components/ui-kits/separator/separator";
import {
  useGetSASTData,
  useSASTRedirectLink,
} from "@/cross-modules/deployment/hooks/use-observability";
import { AlertTriangle, ExternalLink, Shield, Clock } from "lucide-react";
import { useParams } from "react-router";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui-kits/tabs/tabs";
import {
  getSonarQubeDashboardUrl,
  openResolvedUrlInNewTab,
} from "@blocks-deployment/utils/observability-links.utils";
import {
  getNewCodePeriodLabel,
  getNewCodeStats,
  getOverallCodeStats,
  getQualityGateLabel,
  hasNewCode,
  type RatingLetter,
  type SastDetails,
  type SastStat,
} from "@blocks-deployment/utils/sast-metrics.utils";

const RATING_BADGE_CLASS: Record<RatingLetter, string> = {
  A: "bg-green-100 text-green-700",
  B: "bg-lime-100 text-lime-700",
  C: "bg-yellow-100 text-yellow-700",
  D: "bg-orange-100 text-orange-700",
  E: "bg-red-100 text-red-700",
};

const OverviewStats = ({
  stats,
  gridColumns = "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
}: {
  stats: SastStat[];
  gridColumns?: string;
}) => {
  return (
    <div className="w-full space-y-4">
      <div className={`grid w-full gap-x-10 gap-y-2 ${gridColumns}`}>
        {stats.map((item) => (
          <div
            key={item.id}
            data-testid={`sast-stat-${item.id}`}
            className="flex h-20 items-start gap-4">
            <div className="flex-1">
              <p className="text-sm text-high-emphasis">{item.title}</p>
              <p className="text-lg font-semibold">{item.value}</p>
              {item.subtitle && (
                <p className="text-xs text-gray-400">{item.subtitle}</p>
              )}
            </div>
            {renderIndicator(item)}
          </div>
        ))}
      </div>
    </div>
  );
};

const renderIndicator = (item: SastStat) => {
  const { indicator } = item;
  if (indicator.kind === "none") return null;

  if (indicator.kind === "rating") {
    if (!indicator.letter) return null;
    return (
      <div className="flex items-center gap-2">
        <span
          data-testid={`sast-rating-${item.id}`}
          className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${RATING_BADGE_CLASS[indicator.letter]}`}>
          {indicator.letter}
        </span>
      </div>
    );
  }

  const percent = indicator.percent;
  if (percent === null || percent === undefined) return null;
  const percentage = Math.min(100, Math.max(0, percent));
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
        {indicator.kind === "dot" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="h-4 w-4 rounded-full bg-primary"></span>
          </div>
        )}
      </div>
    </div>
  );
};

const getOverviewData = (details: SastDetails) => [
  {
    name: "Quality Gate",
    id: "quality_gate",
    value: getQualityGateLabel(details),
  },
  {
    name: "Lines of code",
    id: "linesOfCode",
    value: details?.ncloc ? Number(details.ncloc).toLocaleString("en-US") : "-",
  },
];

const qualityGateBadgeStatus = (label: string) => {
  if (label === "Not computed") return "Pending";
  return label;
};

const SastTab = () => {
  const params = useParams();
  const buildId = params?.buildId as string;
  const { data: sastData, isLoading, error } = useGetSASTData(buildId);
  const { isLoading: isSASTLoading, refetch: triggerSASTRedirect } =
    useSASTRedirectLink(buildId);

  let details: SastDetails | null | undefined = undefined;
  const envelope = sastData as
    | { data?: { details?: SastDetails | null } }
    | undefined
    | null;
  if (
    envelope &&
    typeof envelope === "object" &&
    envelope.data &&
    typeof envelope.data === "object" &&
    "details" in envelope.data
  ) {
    details = envelope.data.details;
  }

  const overviewData = useMemo(
    () => (details ? getOverviewData(details) : []),
    [details],
  );
  const newCodeStats = useMemo(
    () => (details ? getNewCodeStats(details) : []),
    [details],
  );
  const overallStats = useMemo(
    () => (details ? getOverallCodeStats(details) : []),
    [details],
  );
  const periodLabel = useMemo(
    () => (details ? getNewCodePeriodLabel(details) : null),
    [details],
  );
  const showNewCode = details ? hasNewCode(details) : false;

  const handleSASTRedirect = () =>
    openResolvedUrlInNewTab(async () => {
      const result = await triggerSASTRedirect();
      return getSonarQubeDashboardUrl(result.isError ? undefined : result.data);
    });

  let body: React.ReactNode;
  if (isLoading) {
    body = (
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
    );
  } else if (!error && details) {
    body = (
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
                      ? `${getDeploymentLogEventBadgeClassName(qualityGateBadgeStatus(item.value))} ml-2`
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
          <Tabs defaultValue="new">
            <TabsList>
              <TabsTrigger value="new">New Code</TabsTrigger>
              <TabsTrigger value="overall">Overall Code</TabsTrigger>
            </TabsList>
            <TabsContent value="new" className="mt-4 space-y-3">
              {periodLabel && (
                <p className="text-xs text-medium-emphasis">
                  New code: {periodLabel}
                </p>
              )}
              {showNewCode ? (
                <OverviewStats stats={newCodeStats} />
              ) : (
                <div className="space-y-1 py-6 text-center">
                  <p className="text-sm font-medium text-high-emphasis">
                    No new lines to analyze
                  </p>
                  <p className="text-xs text-medium-emphasis">
                    There is no new code on this branch since the new code
                    period started.
                  </p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="overall" className="mt-4">
              <OverviewStats stats={overallStats} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  } else if (!error && !details) {
    body = (
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
    );
  } else {
    body = (
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
    );
  }

  return <div className="min-h-screen w-full space-y-6">{body}</div>;
};


export default SastTab;
