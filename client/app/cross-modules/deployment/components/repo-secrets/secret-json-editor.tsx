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
export const SecretJsonEditor = ({ form, disabled }: SecretJsonEditorProps) => (
  <SecretPasteField
    form={form}
    disabled={disabled}
    name="json"
    label="JSON"
    description="A flat object of text values. Nested objects, arrays and numbers are not accepted."
    placeholder={'{\n  "API_KEY": "value",\n  "DB_PASSWORD": "value"\n}'}
  />
);
