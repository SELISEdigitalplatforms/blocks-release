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
  isBlankRow,
  mapToEnv,
  mapToJson,
  mapToRows,
} from "@blocks-deployment/utils/repo-secrets.util";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
  type UseFieldArrayReturn,
  type UseFormReturn,
} from "react-hook-form";
import { SecretEnvEditor } from "./secret-env-editor";
import { SecretJsonEditor } from "./secret-json-editor";
import { SecretKvEditor } from "./secret-kv-editor";
import {
  activeTabResult,
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
 * Writes a parsed set into the target tab on a switch. Only called with a valid (so non-empty)
 * set; the blank-row fallback keeps the key/value editor from ever rendering zero rows.
 */
const carryInto = (
  next: SecretEntryMode,
  secrets: RepoSecretMap,
  form: UseFormReturn<ISecretFormValues>,
  fieldArray: UseFieldArrayReturn<ISecretFormValues, "rows">,
): void => {
  if (next === "kv") {
    const rows = mapToRows(secrets);
    fieldArray.replace(rows.length > 0 ? rows : [emptyRow]);
    return;
  }

  form.setValue(next, next === "json" ? mapToJson(secrets) : mapToEnv(secrets));
};

/**
 * Shows the active tab's messages only once the user has edited it, so a fresh tab never opens
 * on an error. Save enablement does not depend on this; it always follows the parse result.
 */
const syncErrors = (
  form: UseFormReturn<ISecretFormValues>,
  editedModes: ReadonlySet<SecretEntryMode>,
): void => {
  if (editedModes.has(form.getValues("mode"))) {
    void form.trigger();
  } else {
    form.clearErrors();
  }
};

/**
 * A whole-list rule ("Add at least one variable.", the size limit). The zod resolver nests it
 * under `rows.root` once row inputs are mounted, so read both places.
 */
const rowsLevelMessage = (errors: FieldErrors<ISecretFormValues>): string | undefined =>
  errors.rows?.root?.message ?? errors.rows?.message;

/** Adding or removing a row counts as editing the key/value tab, the same as typing does. */
const withEditTracking = (
  fieldArray: UseFieldArrayReturn<ISecretFormValues, "rows">,
  onEdit: () => void,
): UseFieldArrayReturn<ISecretFormValues, "rows"> => ({
  ...fieldArray,
  append: (value, options) => {
    fieldArray.append(value, options);
    onEdit();
  },
  remove: (index) => {
    fieldArray.remove(index);
    onEdit();
  },
});

/**
 * Creates or replaces a repository's whole secret set.
 *
 * The form lives in a child so it is mounted only while the dialog is open: a fresh mount reseeds
 * the defaults and discards the previous attempt, which is why there is no reset effect here.
 */

const FIELD_MAPPABLE_REASONS = new Set<string>([
  REPO_SECRET_ERROR.KeyInvalid,
  REPO_SECRET_ERROR.ValueType,
]);

const FORM_LEVEL_REASONS = new Set<string>([
  REPO_SECRET_ERROR.SecretsRequired,
  REPO_SECRET_ERROR.TooLarge,
  REPO_SECRET_ERROR.VaultFailure,
]);

/**
 * The field a server key/value error belongs on. In key/value mode that is the first row that was
 * actually sent: blank rows are dropped from the payload, so row 0 may not be part of it.
 */
const fieldForMode = (values: ISecretFormValues): "json" | "env" | `rows.${number}.key` => {
  if (values.mode === "json") return "json";
  if (values.mode === "env") return "env";
  const firstSent = values.rows.findIndex((row) => !isBlankRow(row));
  return `rows.${Math.max(firstSent, 0)}.key`;
};

/**
 * Routes a server reason code back onto the field (or form banner) that caused it
 * (FRONTEND_DESIGN §6). Kept outside the component so SecretForm stays under Sonar's
 * cognitive-complexity budget.
 */
const applySaveError = (
  error: unknown,
  form: UseFormReturn<ISecretFormValues>,
  setFormError: (message: string | null) => void,
): void => {
  const reason = getServerReason(error);
  const message =
    getServerMessage(error) ?? "The environment variables could not be saved.";

  if (reason && FIELD_MAPPABLE_REASONS.has(reason)) {
    form.setError(fieldForMode(form.getValues()), {
      type: "server",
      message,
    });
    return;
  }

  if (reason && FORM_LEVEL_REASONS.has(reason)) {
    setFormError(message);
    return;
  }

  showErrorToast({ errors: error });
};

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
      mode: "env",
      rows: initialSecrets ? mapToRows(initialSecrets) : [emptyRow],
      json: initialSecrets ? mapToJson(initialSecrets) : "",
      env: initialSecrets ? mapToEnv(initialSecrets) : "",
    },
  });

  const fieldArray = useFieldArray({ control: form.control, name: "rows" });

  // useWatch rather than form.watch: watch() returns a fresh function each render, which the
  // React Compiler cannot memoize and so opts the whole component out of compilation.
  const mode = useWatch({ control: form.control, name: "mode" });
  const [rows, json, env] = useWatch({
    control: form.control,
    name: ["rows", "json", "env"],
  });
  const isPending = saveMutation.isPending;
  const canSave = activeTabResult({ mode, rows, json, env }).ok && !isPending;

  // Tabs the user has typed into (or added / removed rows in) since the dialog opened.
  const [editedModes, setEditedModes] = useState<ReadonlySet<SecretEntryMode>>(() => new Set());

  const markEdited = () => {
    const active = form.getValues("mode");
    // Errors are synced against the updated set straight away rather than after the re-render.
    const next = editedModes.has(active) ? editedModes : new Set(editedModes).add(active);

    if (next !== editedModes) setEditedModes(next);
    syncErrors(form, next);
  };

  /**
   * Never refuses a switch — trapping the user on a tab was worse than any conversion. A valid
   * tab carries its set across; an invalid one converts nothing, so each tab keeps its own text
   * and no typed input is lost.
   */
  const switchMode = (next: SecretEntryMode) => {
    if (next === mode) return;

    const parsed = activeTabResult(form.getValues());

    if (parsed.ok) carryInto(next, parsed.value, form, fieldArray);

    form.setValue("mode", next);
    syncErrors(form, editedModes);
  };

  const rowsMessage = rowsLevelMessage(form.formState.errors);

  const applyServerError = (error: unknown) => {
    applySaveError(error, form, setFormError);
  };

  const onSubmit = async (values: ISecretFormValues) => {
    setFormError(null);

    const parsed = activeTabResult(values);

    // The resolver already proved the active tab parses; the guard narrows the type.
    if (!parsed.ok) return;

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
          // Only the active tab's inputs are mounted, so any change event here is an edit of it.
          onChange={markEdited}
          className="flex flex-col gap-5">
          <div
            role="radiogroup"
            aria-label="Entry mode"
            className="flex w-fit gap-1 rounded-md border border-input p-1">
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

          <SecretModeFields
            mode={mode}
            form={form}
            fieldArray={withEditTracking(fieldArray, markEdited)}
            disabled={isPending}
          />

          {mode === "kv" && rowsMessage && (
            <p className="text-sm text-destructive">{rowsMessage}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              {isPending ? "Saving…" : "Save variables"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
};
