import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import {
  useGetMonitorById,
  useGetMonitorDetails,
  useGetMonitorDownTime,
} from "@blocks-devops/hooks/alerts";
import { useParams, useNavigate } from "react-router-dom";
import IncidentList from "./incident-list";
import ResponseTime from "./response-time";
import { Button } from "@/components/ui-kits/button/button";
import { useState } from "react";
import AddSingleMonitor from "@blocks-devops/components/add-repo/add-repo";
import { Separator } from "@/components/ui-kits/separator/separator";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constant/breadcrumb-custom-title";
import { ArrowLeft, Settings } from "lucide-react";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import AlertAction from "@blocks-devops/components/add-repo/alert-action";
import { IMonitorSummary } from "@blocks-devops/models/alerts";
import MonitorCard from "@blocks-devops/components/add-repo/monitor-card";
import NotificationModal from "@blocks-devops/components/add-repo/notification-modal";
import {
  LoadingListSkelton,
  MonitorCardSkeleton,
  ResponseSkeletonLoader,
} from "@blocks-devops/components/add-repo/skeleton-loader-card";
import { useProjectStore } from "@/store/useProjectStore";

interface MonitorSummaryProps {
  data: IMonitorSummary[];
  status: boolean;
  incident: Date;
  createdAt: string;
}

const MonitorDetailsSkeleton = () => {
  return (
    <main>
      <div className="flex flex-col gap-4">
        <MonitorCardSkeleton />

        <Card className="flex flex-col p-6">
          <CardHeader className="text-lg font-semibold">
            {/* Summary Cards Skeleton */}
            <div className="my-2 flex w-full gap-10">
              <Skeleton className="h-24 flex-1 rounded-md" />
              <Skeleton className="h-24 flex-1 rounded-md" />
              <Skeleton className="h-24 flex-1 rounded-md" />
              <Skeleton className="h-24 flex-1 rounded-md" />
            </div>
          </CardHeader>

          <CardContent>
            {/* Response Time Chart Skeleton */}
            <ResponseSkeletonLoader />
            <Separator orientation="horizontal" className="mb-6" />
            {/* Incident List Skeleton */}
            <LoadingListSkelton length={5} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
};
export const formatDuration = (ms: number) => {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  ms %= 24 * 60 * 60 * 1000;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  ms %= 60 * 60 * 1000;
  const minutes = Math.floor(ms / (60 * 1000));
  ms %= 60 * 1000;
  const seconds = Math.floor(ms / 1000);

  if (days > 0) return `${days}d${hours > 0 ? ` ${hours}h` : ""}`;
  if (hours > 0) return `${hours}h${minutes > 0 ? ` ${minutes}m` : ""}`;
  if (minutes > 0) return `${minutes}m${seconds > 0 ? ` ${seconds}s` : ""}`;
  return `${seconds}s`;
};

const MonitorSummary = ({ data, status, incident, createdAt }: MonitorSummaryProps) => {
  const toMilliseconds = (value: string): number => parseInt(value, 10) * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const incidentDate = new Date(incident);
  const incidentTime =
    incidentDate.getUTCFullYear() === 1 ? new Date(createdAt).getTime() : incidentDate.getTime();

  const incidentDuration = formatDuration(now - incidentTime);

  return (
    <div className="my-6 flex w-full flex-col gap-4 md:flex-row md:gap-10">
      {data.map((item, index) => {
        if (item.type === "status") {
          return (
            <Card
              key={`status-${index}`}
              className={`flex flex-1 flex-col rounded-md border-0 border-l-8 shadow-none ${status ? "border-l-green-500" : "border-l-red-500"
                } bg-transparent py-2 pl-4`}
            >
              <CardTitle className="text-base font-medium">Current Status</CardTitle>
              <CardContent className="mt-3 flex flex-col gap-3">
                <span
                  className={`text-xl font-semibold capitalize ${status ? "text-green-500" : "text-red-500"
                    }`}
                >
                  {item.status}
                </span>
                <span className="text-xs font-medium text-medium-emphasis">
                  {" "}
                  Currently {status ? "up" : "down"} for {incidentDuration}
                </span>
              </CardContent>
            </Card>
          );
        }

        const totalPossibleMs = toMilliseconds(item.range!);
        const uptimePercentage =
          ((totalPossibleMs - item.totalDurationMs!) / totalPossibleMs) * 100;

        return (
          <Card
            key={item.range}
            className={`flex flex-1 flex-col gap-2 rounded-md border-0 border-l-8 bg-transparent py-1 pl-4 shadow-none ${index === 1
                ? "border-l-blocks-secondary-500"
                : index === 2
                  ? "border-l-chart-blue"
                  : "border-l-chart-purple"
              }`}
          >
            <CardTitle className="text-base font-medium">
              Last {item.range?.slice(0, -1)} days
            </CardTitle>
            <CardContent className="mt-3 flex flex-col gap-3">
              <span className="text-xl font-semibold">{uptimePercentage.toFixed(2)}%</span>
              <span className="text-xs font-medium text-primary underline">
                {item.incidentCount} incidents, {formatDuration(item.totalDurationMs!)} down
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

const MonitorDetails = () => {
  const [openNotificationSettings, setOpenNotificationSettings] = useState(false);
  const [open, setOpen] = useState(false);
  const [timeRange, setTimeRange] = useState("1h");
  const projectKey = useProjectStore()?.selectedProject?.tenantId || "";

  const navigate = useNavigate();
  const params = useParams();
  const monitorId = params.id as string;

  const { data, isLoading } = useGetMonitorDetails(monitorId as string);
  const { data: monitorData, isLoading: isMonitorLoading } = useGetMonitorById(monitorId as string);
  const repoName = monitorData?.data?.repoName;
  const repoId = monitorData?.data?.repoId;
  const request = monitorData?.data?.monitorConfigurationType === 0 ? true : false;
  const interval = monitorData?.data?.intervalInSeconds as number;
  const monitorSourceType = monitorData?.data?.monitorSourceTypes;
  const { data: rtData, isLoading: isRTLoading } = useGetMonitorDownTime({
    monitorId,
    timeRange,
    interval,
  });
  const gracePeriod = monitorData?.data?.gracePeriodInSeconds;
  const intervalInSeconds = monitorData?.data?.intervalInSeconds;
  const requestTimeout = monitorData?.data?.timeoutInSeconds;
  const timePeriod = request ? requestTimeout : gracePeriod;

  if (isLoading || isMonitorLoading || isRTLoading) {
    return <MonitorDetailsSkeleton />;
  }

  // Add the status card to the beginning of the array
  const summaryData: IMonitorSummary[] = [
    {
      type: "status",
      status: monitorData?.data?.currentStatus ? "up" : "down", // Use your actual status field from API
      statusDuration: data?.statusDuration || "0h", // Use your actual duration field from API
    },
    ...(data?.dateRangeSummary || []),
  ];

  BREADCRUMB_CUSTOM_TITLES["/alerts/monitor"] = "Alert";

  return (
    <main>
      <div className="hidden md:flex">{/* <PageBreadcrumb breadcrumbIndex={2} /> */}</div>
      <div className="mb-[18px] flex items-center justify-between md:mb-[24px]">
        <div className="flex items-center">
          {" "}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-lg font-semibold md:text-2xl">{monitorData?.data?.name}</h1>
        </div>
        {monitorSourceType !== 2 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => setOpenNotificationSettings((open) => !open)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Notification Settings
            </Button>
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => setOpen((open) => !open)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Configure
            </Button>
            <Button variant={"outline"}>
              <AlertAction
                monitorId={monitorId as string}
                isActive={monitorData?.data?.isActive ?? false}
                name={monitorData?.data?.name || ""}
                request={request}
                projectKey={projectKey}
                monitorSourceType={monitorSourceType}
              />
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-5">
        {" "}
        <MonitorCard
          onOpenChange={setOpenNotificationSettings}
          repoName={monitorData?.data?.repoName || ""}
          url={monitorData?.data?.url || ""}
          request={request}
          emails={monitorData?.data?.emails || []}
          monitorSourceType={monitorData?.data?.monitorSourceTypes ?? 0}
        />
        <Card className="flex flex-col px-6 py-2">
          <CardHeader className="text-lg font-semibold">
            <MonitorSummary
              data={summaryData}
              status={monitorData?.data?.currentStatus ?? false}
              incident={
                monitorData?.data?.lastIncidentAt
                  ? new Date(monitorData?.data?.lastIncidentAt)
                  : new Date()
              }
              createdAt={monitorData?.data?.createdDate as string}
            />
          </CardHeader>
          <CardContent>
            <ResponseTime
              request={request}
              interval={intervalInSeconds || 30}
              timeout={timePeriod || 60}
              data={rtData?.data || []}
              timeRange={timeRange}
              setTimeRange={setTimeRange}
              currentStatus={monitorData?.data?.currentStatus || false}
            />
            <Separator orientation="horizontal" className="mb-6" />
            <div className="flex flex-col gap-5">
              <div className="flex w-full justify-between">
                {" "}
                <span className="text-lg font-semibold">Latest incidents</span>
                {data?.monitorIncidents && data.monitorIncidents.length > 4 && (
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/health/monitor/incidents/${monitorId}`)}
                  >
                    View all incidents
                  </Button>
                )}
              </div>
              <IncidentList data={data?.monitorIncidents || []} showLastStatus={request} />{" "}
            </div>
          </CardContent>
          <AddSingleMonitor
            open={open}
            onOpenChange={setOpen}
            itemId={monitorId as string}
            request={request}
            repoId={repoId as string}
            repoName={repoName as string}
          />
          <NotificationModal
            open={openNotificationSettings}
            onOpenChange={setOpenNotificationSettings}
            data={{
              name: monitorData?.data?.name || "",
              repoId: monitorData?.data?.repoId || "",
              repoName: monitorData?.data?.repoName || "",
              itemId: monitorId || "",
              emails: monitorData?.data?.emails || [],
              isActive: monitorData?.data?.isActive || false,
              projectKey: projectKey,
            }}
            request={request}
          />
        </Card>
      </div>
    </main>
  );
};

export default MonitorDetails;
