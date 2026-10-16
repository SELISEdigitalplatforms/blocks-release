import { GitBranch, Loader2, X } from "lucide-react";
import { LogoLoader } from "@/components/loader-spinner/logo-loader";
import { useState, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { IRepoResponse } from "@blocks-deployment/components/deployment-home/repo-cards/repo-cards";
import { Button } from "@/components/ui-kits/button/button";
import type { QueryObserverResult } from "@tanstack/react-query";
import type { IBranchMatchResponse } from "@blocks-deployment/models/github-info";

type ModalState = "loading" | "error" | "success";

interface BranchVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onApiComplete: () => void;
  onRetry: () => void;
  onReopenModal: () => void;
  onForceShowSuccess: () => void;
  repo: IRepoResponse;
  refetch: () => Promise<QueryObserverResult<IBranchMatchResponse>>;
  isProcessing: boolean;
  skipInitialVerification?: boolean;
}

export default function BranchVerificationModal({
  isOpen,
  onClose,
  onSuccess,
  repo,
  refetch,
  isProcessing,
  skipInitialVerification = false,
  onApiComplete,
  onReopenModal,
  onRetry,
}: BranchVerificationModalProps) {
  const [modalState, setModalState] = useState<ModalState>("loading");
  const [isRetrying, setIsRetrying] = useState(false);
  const isCancelledRef = useRef(false);
  const isRetryingRef = useRef(false);

  const handleBranchVerification = async () => {
    try {
      const result = await refetch();

      onApiComplete();

      setIsRetrying(false);
      isRetryingRef.current = false;

      if (isCancelledRef.current) {
        if (result.error || !result.data?.isSuccess) {
          setTimeout(() => {
            onReopenModal();
          }, 100);
        }
        return;
      }

      if (result.error) {
        setModalState("error");
        toast({
          title: "Branch Match Failed",
          description: "Unable to check branch compatibility. Please try again later.",
          variant: "destructive",
        });
        return;
      }

      if (result.data?.isSuccess) {
        setModalState("success");
        setTimeout(() => {
          if (!isCancelledRef.current) {
            onSuccess();
          }
        }, 800);
      } else {
        setModalState("error");
      }
    } catch {
      onApiComplete();

      setIsRetrying(false);
      isRetryingRef.current = false;

      if (isCancelledRef.current) {
        setTimeout(() => {
          onReopenModal();
        }, 100);
        return;
      }

      setModalState("error");
      toast({
        title: "Branch Match Failed",
        description: "Unable to check branch compatibility. Please try again later.",
        variant: "destructive",
      });
    }
  };

  // Opening shows the right first screen and closing clears the retry flag. Done while
  // rendering; isRetrying is set and cleared together with isRetryingRef, so it is the
  // same guard the effect below uses.
  const [syncedFrom, setSyncedFrom] = useState<{
    isOpen: boolean;
    skipInitialVerification: boolean;
  } | null>(null);
  if (
    syncedFrom?.isOpen !== isOpen ||
    syncedFrom.skipInitialVerification !== skipInitialVerification
  ) {
    setSyncedFrom({ isOpen, skipInitialVerification });
    if (isOpen) {
      if (!isRetrying) {
        setModalState(skipInitialVerification ? "error" : "loading");
      }
    } else {
      setIsRetrying(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      if (isRetryingRef.current) {
        return;
      }

      isCancelledRef.current = false;

      if (!skipInitialVerification) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- only sets state after awaiting refetch()
        handleBranchVerification();
      }
    } else {
      isRetryingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, skipInitialVerification]);

  const handleClose = () => {
    if (modalState === "loading") {
      isCancelledRef.current = true;
    }

    setIsRetrying(false);
    onClose();
  };

  const handleBackdropClick = () => {
    if (modalState !== "loading") {
      handleClose();
    }
  };

  const handleRetry = () => {
    isRetryingRef.current = true;

    setIsRetrying(true);
    isCancelledRef.current = false;

    onRetry();

    setTimeout(() => {
      if (!isCancelledRef.current) {
        setModalState("loading");
        handleBranchVerification();
      }
    }, 200);
  };

  if (!isOpen) return null;

  const getModalContent = () => {
    switch (modalState) {
      case "loading":
        return {
          title: "",
          content: (
            <div className="flex flex-col items-center px-2 pb-2 pt-4 text-center">
              <LogoLoader size={44} label="Loading" />
              <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                Checking your repository setup. This may take a few seconds.
              </p>
              {repo.branch && (
                <span className="mt-4 inline-flex items-center gap-1.5 rounded-sm bg-primary/[0.07] px-2 py-1 text-xs font-medium text-primary">
                  <GitBranch className="h-3 w-3" aria-hidden="true" />
                  {repo.repoName?.split("/").pop()} · {repo.branch}
                </span>
              )}
            </div>
          ),
          // The header's close button already cancels; a second Cancel would repeat it.
          footer: null,
        };

      case "error":
        return {
          title: "Expected branch not available",
          content: (
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-sunset-soft text-warn-ink">
                <GitBranch className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed text-medium-emphasis">
                This environment expects a branch named{" "}
                <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs text-high-emphasis">
                  {repo.branch}
                </code>
                . Create it, or adjust the branch name in your Git repository, to proceed to
                deployment.
              </p>
            </div>
          ),
          footer: (
            <>
              <Button
                onClick={handleClose}
                variant="outline"
                size="sm"
                disabled={isRetrying || isProcessing}
              >
                Close
              </Button>
              <Button
                onClick={handleRetry}
                size="sm"
                className="gap-2"
                disabled={isRetrying || isProcessing}
              >
                {isRetrying && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {isRetrying ? "Retrying..." : "Retry"}
              </Button>
            </>
          ),
        };

      default:
        return null;
    }
  };

  const modalContent = getModalContent();
  if (!modalContent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        role="button"
        tabIndex={0}
        aria-label="Close dialog"
        className="fixed inset-0 bg-black/50"
        onClick={handleBackdropClick}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          handleBackdropClick();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={modalContent.title ? undefined : "Verifying repository"}
        aria-labelledby={modalContent.title ? "branch-verification-title" : undefined}
        className="relative mx-4 w-full max-w-md rounded-sm bg-card shadow-xl ring-1 ring-border"
      >
        <div className="flex items-center justify-between gap-4 px-6 pb-2 pt-5">
          {modalContent.title ? (
            <h2
              id="branch-verification-title"
              className="text-base font-semibold text-high-emphasis"
            >
              {modalContent.title}
            </h2>
          ) : (
            <span aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={handleClose}
            aria-label={modalState === "loading" ? "Cancel verification" : "Close"}
            title={modalState === "loading" ? "Cancel verification" : "Close"}
            className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-high-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-2">{modalContent.content}</div>

        {modalContent.footer && (
          <div className="flex justify-end gap-2 border-t border-border-soft px-6 py-4">
            {modalContent.footer}
          </div>
        )}
      </div>
    </div>
  );
}
