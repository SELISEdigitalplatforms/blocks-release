import type { UseFormReturn } from "react-hook-form";
import type { ISecretFormValues } from "./secret-form-values";
import { SecretPasteField } from "./secret-paste-field";

type SecretEnvEditorProps = {
  form: UseFormReturn<ISecretFormValues>;
  disabled: boolean;
};

/**
 * Paste-.env-text mode, for when the user already has KEY=value lines (e.g. from a .env.example)
 * and converting them to rows or JSON would be the slower path.
 */
export const SecretEnvEditor = ({ form, disabled }: SecretEnvEditorProps) => (
  <SecretPasteField
    form={form}
    disabled={disabled}
    name="env"
    label="Env"
    description="One KEY=value per line. Blank lines and # comments are ignored. Values are kept exactly as written after the first =."
    placeholder={"FEATURE_FLAG=enabled\nREGION=eu"}
    aria-label="Environment variables as env"
  />
);
