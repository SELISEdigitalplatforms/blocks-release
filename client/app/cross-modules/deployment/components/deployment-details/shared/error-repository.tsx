import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import { CircleX } from "lucide-react";

export function ErrorRepository({ refetch }: { refetch: () => void }) {
  return (
    <Card>
      <div className="flex h-auto flex-col items-center justify-center self-stretch rounded-sm bg-background px-1 py-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <CircleX className="h-8 w-8 text-low-emphasis" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h3 className="py-4 text-xl font-semibold text-high-emphasis text-destructive">
            Error while fetching repositories
          </h3>
        </div>
        <Button onClick={() => refetch()} size={"sm"} className="mt-6">
          Retry
        </Button>
      </div>
    </Card>
  );
}
