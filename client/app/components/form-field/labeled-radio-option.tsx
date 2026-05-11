import { RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";

type LabeledRadioOptionProps = {
  id: string;
  value: string;
  label: string;
  disabled?: boolean;
};

export const LabeledRadioOption = ({
  id,
  value,
  label,
  disabled,
}: LabeledRadioOptionProps) => {
  return (
    <div className="flex items-center gap-2">
      <RadioGroupItem value={value} id={id} disabled={disabled} />
      <label className="cursor-pointer select-none" htmlFor={id}>
        {label}
      </label>
    </div>
  );
};
