import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";

export const LoadingListSkelton = ({ length }: { length: number }) => (
  <div className="grid w-full gap-2">
    {Array.from({ length: length }).map((_, index) => (
      <Skeleton key={index} className="h-12 w-full rounded-xl" />
    ))}
  </div>
);

export const MonitorCardSkeleton = () => {
  return (
    <Card className="rounded-lg border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          <Skeleton className="h-4 w-40" />
        </CardTitle>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
        {/* Deploys from */}
        <div>
          <div className="mb-1">
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        {/* URL to monitor */}
        <div>
          <div className="mb-1">
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-60" />
        </div>
        {/* Monitor type */}
        <div className="sm:col-span-2">
          <div className="mb-1">
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-32" />
        </div>
        {/* Notification recipients */}
      </CardContent>
    </Card>
  );
};
export const ResponseSkeletonLoader = () => {
  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="mb-4 flex gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-[200px] w-full rounded" />
    </div>
  );
};
