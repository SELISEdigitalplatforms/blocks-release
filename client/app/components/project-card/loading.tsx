import { Card } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";

export const ProjectCardLoading = () => {
  return (
    <Card className="flex h-[160px] flex-col overflow-hidden rounded-xl border border-border/60 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="mt-1.5 h-4 w-3/5" />
        </div>
        <Skeleton className="h-8 w-8 flex-shrink-0 rounded-md" />
      </div>
      <div className="mt-auto flex flex-wrap gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </Card>
  );
};
