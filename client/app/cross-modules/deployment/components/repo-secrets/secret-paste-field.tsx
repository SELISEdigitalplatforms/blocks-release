import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import type { UseFormReturn } from "react-hook-form";
import type { ISecretFormValues } from "./secret-form-values";

type SecretPasteFieldName = "json" | "env";

type SecretPasteFieldProps = {
  form: UseFormReturn<ISecretFormValues>;
  disabled: boolean;
  name: SecretPasteFieldName;
  label: string;
  description: string;
  placeholder: string;
  "aria-label"?: string;
};

/**
 * Shared textarea field for the paste-based entry modes (JSON and Env). The two modes only
 * differ by field name, labels and copy — the control chrome stays one place so they cannot
 * drift and Sonar does not see the markup twice.
 */
export const SecretPasteField = ({
  form,
  disabled,
  name,
  label,
  description,
  placeholder,
  "aria-label": ariaLabel,
}: SecretPasteFieldProps) => (
  <FormField
    control={form.control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormLabel>
          {label} <span className="text-destructive">*</span>
        </FormLabel>
        <FormControl>
          <Textarea
            {...field}
            rows={12}
            spellCheck={false}
            disabled={disabled}
            className="font-mono text-sm"
            aria-label={ariaLabel}
            placeholder={placeholder}
          />
        </FormControl>
        <FormDescription>{description}</FormDescription>
        <FormMessage />
      </FormItem>
    )}
  />
);
