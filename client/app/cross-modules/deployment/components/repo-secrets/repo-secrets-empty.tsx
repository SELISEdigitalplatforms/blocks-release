import { Button } from "@/components/ui-kits/button/button";
import { KeyRound } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";

type RepoSecretsEmptyProps = {
  onAdd: () => void;
  disabled?: boolean;
};

/**
 * First-run state for a repository that has never had environment variables.
 *
 * A local component rather than a shared `EmptyState` primitive — this app has no such primitive,
 * and introducing one here would change screens this change has no business touching.
 */
export const RepoSecretsEmpty = ({ onAdd, disabled }: RepoSecretsEmptyProps) => {
  const { t } = useT("release.deployment.secrets");

  return (
  <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
    <div className="rounded-full bg-muted p-3">
      <KeyRound className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
    </div>
    <h3 className="text-base font-semibold">{t("REPO_SECRETS_EMPTY.TITLE")}</h3>
    <p className="max-w-md text-sm text-muted-foreground">
      {t("REPO_SECRETS_EMPTY.DESCRIPTION")}
    </p>
    <Button type="button" onClick={onAdd} disabled={disabled}>
      {t("REPO_SECRETS_EMPTY.ADD_VARIABLES")}
    </Button>
  </div>
  );
};
