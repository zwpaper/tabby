import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { geminiLanguages } from "@/lib/live/gemini-languages";

type LanguageSelectorProps = {
  value: string;
  onValueChange: (value: string) => void;
};

export const LanguageSelector = ({
  value,
  onValueChange,
}: LanguageSelectorProps) => {
  return (
    <div className="my-4 flex items-center gap-2">
      <Label htmlFor="language-select">Language</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id="language-select" className="w-full">
          <SelectValue placeholder="Select a language" />
        </SelectTrigger>
        <SelectContent>
          {geminiLanguages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
