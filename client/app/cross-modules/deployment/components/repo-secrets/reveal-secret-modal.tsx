import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button/copy-to-clipboard-button";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import type { RepoSecretMap } from "@blocks-deployment/models/repo-secrets.model";
import { mapToJson } from "@blocks-deployment/utils/repo-secrets.util";
import { useState } from "react";

type RevealSecretModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secrets: RepoSecretMap | null;
};

type RevealMode = "kv" | "json";

/**
 * Shows the fetched set in plaintext.
 *
 * Deliberately mirrors the editor's layout — same toggle, same two-column grid — so a reader is
 * looking at the same shape they will edit, rather than having to re-map one view onto the other.
 * It is read-only: the editor's add and remove controls are replaced by a copy control, which is
 * the only thing anyone wants to do from here.
 *
 * The values are passed in rather than fetched here, so the single audited read stays owned by the
 * action the user clicked; the panel drops its copy when this closes.
 */
export const RevealSecretModal = ({
  open,
  onOpenChange,
  secrets,
}: RevealSecretModalProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      {/* Mounted only while open, so the view mode resets to key/value on every reveal. */}
      {open && <RevealSecretBody secrets={secrets} />}
    </DialogContent>
  </Dialog>
);

const RevealSecretBody = ({ secrets }: { secrets: RepoSecretMap | null }) => {
  const [mode, setMode] = useState<RevealMode>("kv");

  const entries = Object.entries(secrets ?? {});
  const json = mapToJson(secrets ?? {});

  return (
    <>
      <DialogHeader>
        <DialogTitle>Repository secrets</DialogTitle>
        <DialogDescription>
          These values are shown in full. Reading them is recorded in the
          activity log.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-5">
        <div
          role="radiogroup"
          aria-label="View mode"
          className="flex w-fit gap-1 rounded-md border border-input p-1">
          <Button
            type="button"
            role="radio"
            aria-checked={mode === "kv"}
            size="sm"
            variant={mode === "kv" ? "secondary" : "ghost"}
            onClick={() => setMode("kv")}>
            Key / value
          </Button>
          <Button
            type="button"
            role="radio"
            aria-checked={mode === "json"}
            size="sm"
            variant={mode === "json" ? "secondary" : "ghost"}
            onClick={() => setMode("json")}>
            JSON
          </Button>
        </div>

        {mode === "kv" ? (
          <div className="flex flex-col gap-3">
            <div className="hidden gap-3 sm:grid sm:grid-cols-[1fr_1fr_auto]">
              <Label className="text-xs text-muted-foreground">Key</Label>
              <Label className="text-xs text-muted-foreground">Value</Label>
              <span className="w-[70px]" />
            </div>

            {entries.map(([key, value]) => (
              <div
                key={key}
                className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  readOnly
                  value={key}
                  aria-label={`Key ${key}`}
                  className="font-mono text-sm"
                />
                <Input
                  readOnly
                  value={value}
                  aria-label={`Value of ${key}`}
                  className="font-mono text-sm"
                  // Empty is a legitimate stored value; say so rather than showing a blank box
                  // the reader has to interpret.
                  placeholder="(empty)"
                />
                <CopyToClipboardButton textToCopy={value}>
                  <></>
                </CopyToClipboardButton>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">JSON</Label>
              <CopyToClipboardButton textToCopy={json}>
                <span className="text-xs text-muted-foreground">Copy all</span>
              </CopyToClipboardButton>
            </div>
            <Textarea
              readOnly
              value={json}
              rows={Math.min(entries.length * 2 + 4, 16)}
              aria-label="Secrets as JSON"
              className="font-mono text-sm"
            />
          </div>
        )}
      </div>
    </>
  );
};
