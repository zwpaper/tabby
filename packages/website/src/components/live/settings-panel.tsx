import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLiveAPIContext } from "@/hooks/live/use-live-api-context";
import { SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { LanguageSelector } from "./language-selector";

export const SettingsPanel = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { languageCode, setLanguageCode } = useLiveAPIContext();

  useEffect(() => {
    const savedLanguage = localStorage.getItem("languageCode");
    if (!savedLanguage) {
      setIsOpen(true);
    }
  }, []);

  const handleLanguageChange = (value: string) => {
    setLanguageCode(value);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <SettingsIcon className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <LanguageSelector
          value={languageCode}
          onValueChange={handleLanguageChange}
        />
      </DialogContent>
    </Dialog>
  );
};
