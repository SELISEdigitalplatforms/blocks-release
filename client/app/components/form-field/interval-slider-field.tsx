import { InfoTooltip } from "@/components/info-tool-tip/info-tool-tip";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Slider } from "@/components/ui-kits/slider/slider";
import { type Control, type FieldValues, type Path } from "react-hook-form";

type IntervalSliderFieldProps<TFormValues extends FieldValues> = {
  control: Control<TFormValues>;
  name: Path<TFormValues>;
  label: string;
  tooltipContent?: string;
  tickLabels: string[];
  min?: number;
  max?: number;
  step?: number;
};

export const IntervalSliderField = <TFormValues extends FieldValues>({
  control,
  name,
  label,
  tooltipContent,
  tickLabels,
  min = 1,
  max = 5,
  step = 1,
}: IntervalSliderFieldProps<TFormValues>) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-col gap-2">
          <FormLabel className="flex items-center gap-2">
            {label}
            {tooltipContent && <InfoTooltip content={tooltipContent} />}
          </FormLabel>
          <FormControl>
            <Slider
              min={min}
              max={max}
              step={step}
              value={[field.value as number]}
              onValueChange={(values) => field.onChange(values[0])}
            />
          </FormControl>

          <div className="flex justify-between px-1 text-xs text-muted-foreground">
            {tickLabels.map((tickLabel) => (
              <span key={tickLabel}>{tickLabel}</span>
            ))}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
