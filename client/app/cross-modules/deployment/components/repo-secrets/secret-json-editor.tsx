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

type SecretJsonEditorProps = {
  form: UseFormReturn<ISecretFormValues>;
  disabled: boolean;
};

/**
 * Paste-a-JSON-object mode, for when the user already has the set in hand and typing it row by
 * row would be the slower path.
 */
export const SecretJsonEditor = ({ form, disabled }: SecretJsonEditorProps) => (
  <FormField
    control={form.control}
    name="json"
    render={({ field }) => (
      <FormItem>
        <FormLabel>
          JSON <span className="text-destructive">*</span>
        </FormLabel>
        <FormControl>
          <Textarea
            {...field}
            rows={12}
            spellCheck={false}
            disabled={disabled}
            className="font-mono text-sm"
            placeholder={'{\n  "API_KEY": "value",\n  "DB_PASSWORD": "value"\n}'}
          />
        </FormControl>
        <FormDescription>
          A flat object of text values. Nested objects, arrays and numbers are
          not accepted.
        </FormDescription>
        <FormMessage />
      </FormItem>
    )}
  />
);
