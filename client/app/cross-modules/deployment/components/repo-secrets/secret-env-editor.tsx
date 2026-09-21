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

type SecretEnvEditorProps = {
  form: UseFormReturn<ISecretFormValues>;
  disabled: boolean;
};

/**
 * Paste-.env-text mode, for when the user already has KEY=value lines (e.g. from a .env.example)
 * and converting them to rows or JSON would be the slower path.
 */
export const SecretEnvEditor = ({ form, disabled }: SecretEnvEditorProps) => (
  <FormField
    control={form.control}
    name="env"
    render={({ field }) => (
      <FormItem>
        <FormLabel>
          Env <span className="text-destructive">*</span>
        </FormLabel>
        <FormControl>
          <Textarea
            {...field}
            rows={12}
            spellCheck={false}
            disabled={disabled}
            className="font-mono text-sm"
            aria-label="Environment variables as env"
            placeholder={"API_KEY=value\nDB_PASSWORD=value"}
          />
        </FormControl>
        <FormDescription>
          One KEY=value per line. Blank lines and # comments are ignored. Values
          are kept exactly as written after the first =.
        </FormDescription>
        <FormMessage />
      </FormItem>
    )}
  />
);
