import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Loader, RotateCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { getRuntimeEnv } from "@/lib/runtime-env";

interface RepositoryAccessModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthorized: () => void;
  refetchAuthorization: () => Promise<{
    data?: { isSuccess?: boolean } | undefined;
  }>;
}

const formatElapsed = (seconds: number) => {
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining === 0
    ? `${minutes}m ago`
    : `${minutes}m ${remaining}s ago`;
};

export function RepositoryAccessModal({
  isOpen,
  onOpenChange,
  onAuthorized,
  refetchAuthorization,
}: RepositoryAccessModalProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastFailureAt, setLastFailureAt] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setIsRetrying(false);
      setLastFailureAt(null);
      setElapsedSeconds(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !lastFailureAt) return;
    const tick = () =>
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - lastFailureAt.getTime()) / 1000)),
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [isOpen, lastFailureAt]);

  const handleRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      const result = await refetchAuthorization();
      if (result.data?.isSuccess) {
        onAuthorized();
      } else {
        setLastFailureAt(new Date());
      }
    } catch {
      setLastFailureAt(new Date());
    } finally {
      setIsRetrying(false);
    }
  };

  const handleOpenManageRepos = () => {
    window.open(
      `${getRuntimeEnv("BLOCKS_OS_URL")}/project-overview/repositories`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[460px] p-6">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-error" />
          </div>
          <DialogTitle>Repository access denied</DialogTitle>
          <DialogDescription>
            You are not authenticated by GitHub or you are not authorized to
            view this repository. Manage your repository access in Blocks OS
            and try again.
          </DialogDescription>
        </DialogHeader>

        {lastFailureAt && (
          <div className="rounded-sm border border-error/40 bg-destructive/5 px-3 py-2">
            <p className="text-sm font-medium text-error">
              Authorization still denied. Please grant access in Blocks OS
              before retrying.
            </p>
            <p className="mt-1 text-[10px] text-error/80">
              Last attempt: {formatElapsed(elapsedSeconds)}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenManageRepos}
            disabled={isRetrying}>
            <ExternalLink size={16} className="mr-2" />
            Manage repositories
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleRetry}
            disabled={isRetrying}>
            {isRetrying ? (
              <>
                <Loader size={16} className="mr-2 animate-spin" />
                Retrying…
              </>
            ) : (
              <>
                <RotateCw size={16} className="mr-2" />
                Retry
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
