import { useT } from "@seliseblocks/genesis-os";
import type { UseFormReturn } from "react-hook-form";
import type { ISecretFormValues } from "./secret-form-values";
import { SecretPasteField } from "./secret-paste-field";

type SecretJsonEditorProps = {
  form: UseFormReturn<ISecretFormValues>;
  disabled: boolean;
};

/**
 * Paste-a-JSON-object mode, for when the user already has the set in hand and typing it row by
 * row would be the slower path.
 */
export const SecretJsonEditor = ({ form, disabled }: SecretJsonEditorProps) => {
  const { t } = useT("release.deployment.secrets");

  return (
  <SecretPasteField
    form={form}
    disabled={disabled}
    name="json"
    label={t("SECRET_JSON_EDITOR.LABEL")}
    description={t("SECRET_JSON_EDITOR.DESCRIPTION")}
    placeholder={'{\n  "FEATURE_FLAG": "enabled",\n  "REGION": "eu"\n}'}
  />
  );
};
