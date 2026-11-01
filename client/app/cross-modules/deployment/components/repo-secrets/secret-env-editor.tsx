import { useT } from "@seliseblocks/genesis-os";
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
export const SecretEnvEditor = ({ form, disabled }: SecretEnvEditorProps) => {
  const { t } = useT("release.deployment.secrets");

  return (
  <SecretPasteField
    form={form}
    disabled={disabled}
    name="env"
    label={t("SECRET_ENV_EDITOR.LABEL")}
    description={t("SECRET_ENV_EDITOR.DESCRIPTION")}
    placeholder={"FEATURE_FLAG=enabled\nREGION=eu"}
    aria-label={t("SECRET_ENV_EDITOR.ARIA_LABEL")}
  />
  );
};
