import { Checkbox } from "@/components/ui/checkbox";
import type { CheckedState } from "@radix-ui/react-checkbox";

interface SettingsCheckboxOptionProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: CheckedState) => void;
}

export const SettingsCheckboxOption: React.FC<SettingsCheckboxOptionProps> = ({
  id,
  label,
  checked,
  onCheckedChange,
}) => {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <label
        htmlFor={id}
        className="font-bold text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
      </label>
    </div>
  );
};
