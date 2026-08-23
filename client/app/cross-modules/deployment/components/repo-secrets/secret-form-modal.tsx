import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Form } from "@/components/ui-kits/form/form";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { REPO_SECRET_ERROR } from "@blocks-deployment/models/repo-secrets.model";
import type { RepoSecretMap } from "@blocks-deployment/models/repo-secrets.model";
import { useSaveRepoSecrets } from "@blocks-deployment/hooks/use-repo-secrets";
import {
  getServerMessage,
  getServerReason,
  mapToJson,
  mapToRows,
  parseSecretJson,
  rowsToMap,
} from "@blocks-deployment/utils/repo-secrets.util";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { SecretJsonEditor } from "./secret-json-editor";
import { SecretKvEditor } from "./secret-kv-editor";
import {
  secretFormSchema,
  type ISecretFormValues,
  type SecretEntryMode,
} from "./secret-form-values";

type SecretFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repoId: string;
  /** Present when editing: the current set, already fetched through the audited reveal. */
  initialSecrets?: RepoSecretMap;
};

type SecretFormProps = Omit<SecretFormModalProps, "open">;

const emptyRow = { key: "", value: "" };

/**
 * Creates or replaces a repository's whole secret set.
 *
 * The form lives in a child so it is mounted only while the dialog is open: a fresh mount reseeds
 * the defaults and discards the previous attempt, which is why there is no reset effect here.
 */
export const SecretFormModal = ({
  open,
  onOpenChange,
  repoId,
  initialSecrets,
}: SecretFormModalProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      {open && (
        <SecretForm
          onOpenChange={onOpenChange}
          repoId={repoId}
          initialSecrets={initialSecrets}
        />
      )}
    </DialogContent>
  </Dialog>
);

const SecretForm = ({
  onOpenChange,
  repoId,
  initialSecrets,
}: SecretFormProps) => {
  const isEdit = !!initialSecrets;
  const [formError, setFormError] = useState<string | null>(null);
  const saveMutation = useSaveRepoSecrets();

  const form = useForm<ISecretFormValues>({
    resolver: zodResolver(secretFormSchema),
    defaultValues: {
      mode: "kv",
      rows: initialSecrets ? mapToRows(initialSecrets) : [emptyRow],
      json: initialSecrets ? mapToJson(initialSecrets) : "",
    },
  });

  const fieldArray = useFieldArray({ control: form.control, name: "rows" });

  // useWatch rather than form.watch: watch() returns a fresh function each render, which the
  // React Compiler cannot memoize and so opts the whole component out of compilation.
  const mode = useWatch({ control: form.control, name: "mode" });
  const isPending = saveMutation.isPending;

  /**
   * Carries content across a mode switch instead of clearing it — losing typed input is the
   * worst thing this screen could do. Switching to rows is refused while the JSON does not
   * parse, because there is nothing to convert.
   */
  const switchMode = (next: SecretEntryMode) => {
    if (next === mode) return;

    if (next === "json") {
      form.setValue("json", mapToJson(rowsToMap(form.getValues("rows"))));
      form.setValue("mode", "json");
      form.clearErrors();
      return;
    }

    const parsed = parseSecretJson(form.getValues("json"));

    if (!parsed.ok) {
      form.setError("json", { type: "manual", message: parsed.message });
      return;
    }

    fieldArray.replace(mapToRows(parsed.value));
    form.setValue("mode", "kv");
    form.clearErrors();
  };

  /** Routes a server reason code back onto the field that caused it (FRONTEND_DESIGN §6). */
  const applyServerError = (error: unknown) => {
    const reason = getServerReason(error);
    const message = getServerMessage(error) ?? "The environment variables could not be saved.";

    const fieldMappable =
      reason === REPO_SECRET_ERROR.KeyInvalid ||
      reason === REPO_SECRET_ERROR.ValueType;

    if (fieldMappable) {
      if (form.getValues("mode") === "json") {
        form.setError("json", { type: "server", message });
      } else {
        form.setError("rows.0.key", { type: "server", message });
      }

      return;
    }

    const formLevel =
      reason === REPO_SECRET_ERROR.SecretsRequired ||
      reason === REPO_SECRET_ERROR.TooLarge ||
      reason === REPO_SECRET_ERROR.VaultFailure;

    if (formLevel) {
      setFormError(message);
      return;
    }

    showErrorToast({ errors: error });
  };

  const onSubmit = async (values: ISecretFormValues) => {
    setFormError(null);

    let secrets: RepoSecretMap;

    if (values.mode === "json") {
      const parsed = parseSecretJson(values.json);

      // The resolver already proved this parses; the guard is here to narrow the type.
      if (!parsed.ok) {
        form.setError("json", { type: "manual", message: parsed.message });
        return;
      }

      secrets = parsed.value;
    } else {
      secrets = rowsToMap(values.rows);
    }

    try {
      await saveMutation.mutateAsync({ repoId, secrets });
      showSuccessToast({ description: "Environment variables saved successfully" });
      onOpenChange(false);
    } catch (error) {
      // Deliberately leaves the dialog open so the user's input survives the failure.
      applyServerError(error);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEdit ? "Edit environment variables" : "Add environment variables"}
        </DialogTitle>
        <DialogDescription>
          Saving replaces the whole set for this repository. Values are stored
          in Key Vault, never in the repository.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-5">
          <div
            role="radiogroup"
            aria-label="Entry mode"
            className="flex w-fit gap-1 rounded-md border border-input p-1">
            <Button
              type="button"
              role="radio"
              aria-checked={mode === "kv"}
              size="sm"
              variant={mode === "kv" ? "secondary" : "ghost"}
              disabled={isPending}
              onClick={() => switchMode("kv")}>
              Key / value
            </Button>
            <Button
              type="button"
              role="radio"
              aria-checked={mode === "json"}
              size="sm"
              variant={mode === "json" ? "secondary" : "ghost"}
              disabled={isPending}
              onClick={() => switchMode("json")}>
              Paste JSON
            </Button>
          </div>

          {formError && (
            <div
              role="alert"
              className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}

          {mode === "kv" ? (
            <SecretKvEditor
              form={form}
              fieldArray={fieldArray}
              disabled={isPending}
            />
          ) : (
            <SecretJsonEditor form={form} disabled={isPending} />
          )}

          {form.formState.errors.rows?.message && (
            <p className="text-sm text-destructive">
              {form.formState.errors.rows.message}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save variables"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
};
