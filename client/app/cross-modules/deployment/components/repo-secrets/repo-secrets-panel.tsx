import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui-kits/card/card";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import {
  useDeleteRepoSecrets,
  useLockRepoSecrets,
  useRepoSecretMeta,
  useRestoreRepoSecrets,
  useRevealRepoSecrets,
  useUnlockRepoSecrets,
} from "@blocks-deployment/hooks/use-repo-secrets";
import {
  REPO_SECRET_STATUS,
  REPO_SECRET_STATUS_LABEL,
  type RepoSecretMap,
} from "@blocks-deployment/models/repo-secrets.model";
import { getServerReason } from "@blocks-deployment/utils/repo-secrets.util";
import { History, Eye, Lock, Pencil, Trash2, Unlock } from "lucide-react";
import { useState } from "react";
import { RepoSecretsEmpty } from "./repo-secrets-empty";
import { RevealSecretModal } from "./reveal-secret-modal";
import { SecretAuditModal } from "./secret-audit-modal";
import { SecretFormModal } from "./secret-form-modal";

type RepoSecretsPanelProps = {
  repoId: string;
  repoName?: string;
};

/** Mirrors the real layout so nothing jumps when the data arrives. */
export const RepoSecretsPanelLoading = () => (
  <Card data-testid="repo-secrets-loading">
    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-9 w-64" />
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-5 w-72" />
    </CardContent>
  </Card>
);

/**
 * The Environment Variables tab body: status, lifecycle actions, and the modals they open.
 *
 * Values are never fetched to render this panel — only a deliberate Reveal or Edit triggers the
 * audited read, and the fetched set is dropped as soon as its dialog closes.
 */
export const RepoSecretsPanel = ({ repoId, repoName }: RepoSecretsPanelProps) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isRevealOpen, setIsRevealOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [revealed, setRevealed] = useState<RepoSecretMap | null>(null);
  const [editing, setEditing] = useState<RepoSecretMap | undefined>(undefined);

  const { data, isLoading, isFetching, error } = useRepoSecretMeta(repoId);

  const reveal = useRevealRepoSecrets();
  const lock = useLockRepoSecrets();
  const unlock = useUnlockRepoSecrets();
  const remove = useDeleteRepoSecrets();
  const restore = useRestoreRepoSecrets();

  if (isLoading) return <RepoSecretsPanelLoading />;

  if (error) {
    const forbidden = getServerReason(error) === "FORBIDDEN";

    return (
      <Card>
        <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
          {forbidden
            ? "You do not have permission to manage environment variables for this repository."
            : "The environment variables for this repository could not be loaded."}
        </CardContent>
      </Card>
    );
  }

  const status = data?.status ?? null;
  const isLocked = status === REPO_SECRET_STATUS.Locked;
  const isDeleted = status === REPO_SECRET_STATUS.Deleted;

  // A refetch dims the panel; it must never drop the user back to the skeleton.
  const isBusy =
    isFetching ||
    reveal.isPending ||
    lock.isPending ||
    unlock.isPending ||
    remove.isPending ||
    restore.isPending;

  const openEditor = (secrets?: RepoSecretMap) => {
    setEditing(secrets);
    setIsFormOpen(true);
  };

  const closeReveal = (open: boolean) => {
    setIsRevealOpen(open);

    // Drop the plaintext as soon as the dialog goes away — it is only ever held for as long as
    // it is on screen.
    if (!open) setRevealed(null);
  };

  const handleReveal = async () => {
    try {
      const result = await reveal.mutateAsync(repoId);
      setRevealed(result.secrets);
      setIsRevealOpen(true);
    } catch (revealError) {
      showErrorToast({ errors: revealError });
    }
  };

  const handleEdit = async () => {
    try {
      // Edit is a replace, not a merge, so the editor has to start from the current set or the
      // untouched keys would be dropped on save.
      const result = await reveal.mutateAsync(repoId);
      openEditor(result.secrets);
    } catch (editError) {
      showErrorToast({ errors: editError });
    }
  };

  const runLifecycle = async (
    action: { mutateAsync: (id: string) => Promise<unknown> },
    successMessage: string,
  ) => {
    try {
      await action.mutateAsync(repoId);
      showSuccessToast({ description: successMessage });
    } catch (lifecycleError) {
      showErrorToast({ errors: lifecycleError });
    }
  };

  if (!data?.hasSecrets) {
    return (
      <>
        <Card>
          <RepoSecretsEmpty onAdd={() => openEditor()} disabled={isBusy} />
        </Card>
        <SecretFormModal
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          repoId={repoId}
          initialSecrets={editing}
        />
      </>
    );
  }

  return (
    <>
      <Card className={isBusy ? "opacity-60 transition-opacity" : undefined}>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold">Environment Variables</h3>
            {status && (
              <Badge variant={isDeleted ? "outline" : "secondary"}>
                {REPO_SECRET_STATUS_LABEL[status]}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isDeleted && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy || isLocked}
                        onClick={handleReveal}>
                        <Eye className="mr-2 h-4 w-4" />
                        Reveal
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {isLocked && (
                    <TooltipContent>
                      Unlock these variables to read or change them.
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}

            {!isDeleted && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy || isLocked}
                onClick={handleEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}

            {!isDeleted &&
              (isLocked ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => runLifecycle(unlock, "Environment variables unlocked")}>
                  <Unlock className="mr-2 h-4 w-4" />
                  Unlock
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => runLifecycle(lock, "Environment variables locked")}>
                  <Lock className="mr-2 h-4 w-4" />
                  Lock
                </Button>
              ))}

            {isDeleted && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => runLifecycle(restore, "Environment variables restored")}>
                Restore
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => setIsAuditOpen(true)}>
              <History className="mr-2 h-4 w-4" />
              Activity
            </Button>

            {!isDeleted && (
              <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive-outline"
                    size="sm"
                    disabled={isBusy}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </DialogTrigger>
                <ConfirmationModal
                  data={{
                    dialogTitle: "Delete environment variables",
                    dialogSubtitle: `The environment variables for ${repoName || "this repository"} will stop being available to deployments. You can restore them later.`,
                    confirmButton: "Delete",
                  }}
                  onCancel={() => setIsDeleteOpen(false)}
                  onConfirm={async () => {
                    await runLifecycle(remove, "Environment variables deleted");
                    setIsDeleteOpen(false);
                  }}
                  buttonState={{ confirm: { disable: remove.isPending } }}
                />
              </Dialog>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>
            Stored in Key Vault. Variable names and values are shown only through a
            deliberate reveal, which is recorded in the activity log.
          </p>
          {data.lastRotatedDate && (
            <p>
              Last changed {new Date(data.lastRotatedDate).toLocaleString()}
              {data.lastRotatedBy ? ` by ${data.lastRotatedBy}` : ""} ·{" "}
              {data.rotationCount} update
              {data.rotationCount === 1 ? "" : "s"}
            </p>
          )}
          {isDeleted && data.deletedDate && (
            <p>Deleted {new Date(data.deletedDate).toLocaleString()}</p>
          )}
        </CardContent>
      </Card>

      <SecretFormModal
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        repoId={repoId}
        initialSecrets={editing}
      />

      <RevealSecretModal
        open={isRevealOpen}
        onOpenChange={closeReveal}
        secrets={revealed}
      />

      <SecretAuditModal
        open={isAuditOpen}
        onOpenChange={setIsAuditOpen}
        repoId={repoId}
      />
    </>
  );
};
