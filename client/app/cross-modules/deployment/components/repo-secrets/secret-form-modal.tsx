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
  mapToEnv,
  mapToJson,
  mapToRows,
  parseSecretEnv,
  parseSecretJson,
  rowsToMap,
  type ParseResult,
} from "@blocks-deployment/utils/repo-secrets.util";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type UseFieldArrayReturn,
  type UseFormReturn,
} from "react-hook-form";
import { SecretEnvEditor } from "./secret-env-editor";
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

type SecretModeFieldsProps = {
  mode: SecretEntryMode;
  form: UseFormReturn<ISecretFormValues>;
  fieldArray: UseFieldArrayReturn<ISecretFormValues, "rows">;
  disabled: boolean;
};

/**
 * Renders the active entry-mode editor. Kept as early returns rather than nested ternaries
 * so Sonar (and readers) see one branch at a time.
 */
const SecretModeFields = ({
  mode,
  form,
  fieldArray,
  disabled,
}: SecretModeFieldsProps) => {
  if (mode === "kv") {
    return (
      <SecretKvEditor form={form} fieldArray={fieldArray} disabled={disabled} />
    );
  }

  if (mode === "json") {
    return <SecretJsonEditor form={form} disabled={disabled} />;
  }

  return <SecretEnvEditor form={form} disabled={disabled} />;
};

/**
 * Reads the current mode's raw input into a map. Shared by mode switches and submit so the
 * parse / reject path is worded once.
 */
const secretsFromValues = (
  mode: SecretEntryMode,
  values: Pick<ISecretFormValues, "rows" | "json" | "env">,
): ParseResult => {
  if (mode === "env") return parseSecretEnv(values.env);
  if (mode === "json") return parseSecretJson(values.json);
  return { ok: true, value: rowsToMap(values.rows) };
};

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
      env: initialSecrets ? mapToEnv(initialSecrets) : "",
    },
  });

  const fieldArray = useFieldArray({ control: form.control, name: "rows" });

  // useWatch rather than form.watch: watch() returns a fresh function each render, which the
  // React Compiler cannot memoize and so opts the whole component out of compilation.
  const mode = useWatch({ control: form.control, name: "mode" });
  const isPending = saveMutation.isPending;

  /**
   * Carries content across a mode switch instead of clearing it — losing typed input is the
   * worst thing this screen could do. Leaving a paste mode is refused while its text does not
   * parse, because there is nothing to convert.
   */
  const switchMode = (next: SecretEntryMode) => {
    if (next === mode) return;

    const parsed = secretsFromValues(mode, form.getValues());

    if (!parsed.ok) {
      if (mode === "json") {
        form.setError("json", { type: "manual", message: parsed.message });
      } else if (mode === "env") {
        form.setError("env", { type: "manual", message: parsed.message });
      }
      return;
    }

    const secrets = parsed.value;

    if (next === "kv") {
      const rows = mapToRows(secrets);
      fieldArray.replace(rows.length > 0 ? rows : [emptyRow]);
    } else if (next === "json") {
      form.setValue("json", mapToJson(secrets));
    } else {
      form.setValue("env", mapToEnv(secrets));
    }

    form.setValue("mode", next);
    form.clearErrors();
  };

  /** Routes a server reason code back onto the field that caused it (FRONTEND_DESIGN §6). */
  const applyServerError = (error: unknown) => {
    const reason = getServerReason(error);
    const message =
      getServerMessage(error) ?? "The environment variables could not be saved.";

    const fieldMappable =
      reason === REPO_SECRET_ERROR.KeyInvalid ||
      reason === REPO_SECRET_ERROR.ValueType;

    if (fieldMappable) {
      const currentMode = form.getValues("mode");

      if (currentMode === "json") {
        form.setError("json", { type: "server", message });
      } else if (currentMode === "env") {
        form.setError("env", { type: "server", message });
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

    const parsed = secretsFromValues(values.mode, values);

    // The resolver already proved paste modes parse; the guard narrows the type.
    if (!parsed.ok) {
      if (values.mode === "json") {
        form.setError("json", { type: "manual", message: parsed.message });
      } else if (values.mode === "env") {
        form.setError("env", { type: "manual", message: parsed.message });
      }
      return;
    }

    const secrets = parsed.value;

    try {
      await saveMutation.mutateAsync({ repoId, secrets });
      showSuccessToast({
        description: "Environment variables saved successfully",
      });
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
            <Button
              type="button"
              role="radio"
              aria-checked={mode === "env"}
              size="sm"
              variant={mode === "env" ? "secondary" : "ghost"}
              disabled={isPending}
              onClick={() => switchMode("env")}>
              Env
            </Button>
          </div>

          {formError && (
            <div
              role="alert"
              className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}

          <SecretModeFields
            mode={mode}
            form={form}
            fieldArray={fieldArray}
            disabled={isPending}
          />

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
