import { Button } from "@/components/ui-kits/button/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import { Plus, Trash2 } from "lucide-react";
import type { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";
import type { ISecretFormValues } from "./secret-form-values";

type SecretKvEditorProps = {
  form: UseFormReturn<ISecretFormValues>;
  fieldArray: UseFieldArrayReturn<ISecretFormValues, "rows">;
  disabled: boolean;
};

/**
 * Key/value rows with an "Add more" button — the default entry mode, chosen because typing two
 * short fields beats composing JSON by hand for the common case of a handful of secrets.
 */
export const SecretKvEditor = ({
  form,
  fieldArray,
  disabled,
}: SecretKvEditorProps) => {
  const { fields, append, remove } = fieldArray;

  return (
    <div className="flex flex-col gap-3">
      <div className="hidden gap-3 sm:grid sm:grid-cols-[1fr_1fr_auto]">
        <FormLabel className="text-xs text-muted-foreground">
          Key <span className="text-destructive">*</span>
        </FormLabel>
        <FormLabel className="text-xs text-muted-foreground">Value</FormLabel>
        <span className="w-9" />
      </div>

      {fields.map((field, index) => (
        <div
          key={field.id}
          className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <FormField
            control={form.control}
            name={`rows.${index}.key`}
            render={({ field: keyField }) => (
              <FormItem>
                <FormLabel className="sr-only">Key {index + 1}</FormLabel>
                <FormControl>
                  <Input
                    {...keyField}
                    placeholder="API_KEY"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`rows.${index}.value`}
            render={({ field: valueField }) => (
              <FormItem>
                <FormLabel className="sr-only">Value {index + 1}</FormLabel>
                <FormControl>
                  {/* type="text", not "password": the user is entering a value they already
                      know, and masking it here only invites typos they cannot see. */}
                  <Input
                    {...valueField}
                    placeholder="value"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove variable ${index + 1}`}
            disabled={disabled || fields.length === 1}
            onClick={() => remove(index)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => append({ key: "", value: "" })}>
          <Plus className="mr-2 h-4 w-4" />
          Add more
        </Button>
      </div>
    </div>
  );
};
