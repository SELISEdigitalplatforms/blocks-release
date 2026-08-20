import { Button } from "@/components/ui-kits/button/button";
import { KeyRound } from "lucide-react";

type RepoSecretsEmptyProps = {
  onAdd: () => void;
  disabled?: boolean;
};

/**
 * First-run state for a repository that has never had secrets.
 *
 * A local component rather than a shared `EmptyState` primitive — this app has no such primitive,
 * and introducing one here would change screens this change has no business touching.
 */
export const RepoSecretsEmpty = ({ onAdd, disabled }: RepoSecretsEmptyProps) => (
  <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
    <div className="rounded-full bg-muted p-3">
      <KeyRound className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
    </div>
    <h3 className="text-base font-semibold">No secrets yet</h3>
    <p className="max-w-md text-sm text-muted-foreground">
      Add the keys and values this repository needs at deploy time. Values are
      stored in Key Vault, never in the repository.
    </p>
    <Button type="button" onClick={onAdd} disabled={disabled}>
      Add secrets
    </Button>
  </div>
);
