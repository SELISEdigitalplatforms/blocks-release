import { Loader, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { IRepoResponse } from "@blocks-deployment/components/deployment-home/repo-cards/repo-cards";
import { Button } from "@/components/ui-kits/button/button";

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
  refetch: () => Promise<any>;
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

  useEffect(() => {
    if (isOpen) {
      if (isRetryingRef.current) {
        return;
      }

      setIsRetrying(false);
      isCancelledRef.current = false;

      if (skipInitialVerification) {
        setModalState("error");
      } else {
        setModalState("loading");
        handleBranchVerification();
      }
    } else {
      setIsRetrying(false);
      isRetryingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, skipInitialVerification]);

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
          description:
            "Unable to check branch compatibility. Please try again later.",
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
        description:
          "Unable to check branch compatibility. Please try again later.",
        variant: "destructive",
      });
    }
  };

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
          title: "Please wait…",
          content: (
            <div className="flex flex-col items-center justify-center space-x-3">
              <div className="mb-2 py-2">
                <Loader className="h-8 w-8 animate-spin" />
              </div>
              <p className="text-sm leading-relaxed text-medium-emphasis">
                We&apos;re verifying your repository setup. This may take a few
                seconds.
              </p>
            </div>
          ),
          footer: (
            <Button
              onClick={handleClose}
              variant="outline"
              className="px-4 py-2 text-sm">
              Cancel
            </Button>
          ),
        };

      case "error":
        return {
          title: "Expected branch not available",
          content: (
            <p className="text-sm leading-relaxed text-gray-600">
              This environment expects a branch named &apos;{repo.branch}&apos;.
              Please create or adjust the branch name in your Git repository to
              proceed to deployment.
            </p>
          ),
          footer: (
            <div className="flex space-x-2">
              <Button
                onClick={handleRetry}
                variant="outline"
                className="px-4 py-2 text-sm"
                disabled={isRetrying || isProcessing}>
                {isRetrying ? (
                  <>
                    <div className="mr-2 h-3 w-3 animate-spin rounded-full border-b-2 border-current"></div>
                    Retrying...
                  </>
                ) : (
                  "Retry"
                )}
              </Button>
              <Button
                onClick={handleClose}
                variant="outline"
                className="px-4 py-2 text-sm"
                disabled={isRetrying || isProcessing}>
                Close
              </Button>
            </div>
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
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={handleBackdropClick}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          handleBackdropClick();
        }}
      />

      <div className="relative mx-4 w-full max-w-md rounded-lg bg-background shadow-xl dark:border dark:border-border">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-semibold">{modalContent.title}</h2>
          <button
            onClick={handleClose}
            className={`p-1 text-gray-400 hover:text-gray-600 ${
              isProcessing ? "hover:text-red-600" : ""
            }`}
            title={isProcessing ? "Cancel operation" : "Close"}>
            <X size={20} />
          </button>
        </div>

        <div className="px-6 pb-4">{modalContent.content}</div>

        <div className="flex justify-end space-x-2 px-6 py-4">
          {modalContent.footer}
        </div>
      </div>
    </div>
  );
}
