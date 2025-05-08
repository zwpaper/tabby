import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { cn } from "@/lib/utils";
import { ChevronRight, Eye, FileEdit, Play } from "lucide-react";
import { useState } from "react";

export function AutoApproveMenu() {
  const {
    autoApproveActive,
    updateAutoApproveActive,
    autoApproveSettings,
    updateAutoApproveSettings,
  } = useSettingsStore();
  const [isOpen, setIsOpen] = useState(false);

  // Create a list of enabled options for the title
  const enabledOptions = Object.entries(autoApproveSettings)
    .filter(([_, value]) => value)
    .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1));

  const handleToggle = (key: keyof typeof autoApproveSettings) => {
    updateAutoApproveSettings({ [key]: !autoApproveSettings[key] });
  };

  const toggleActive = (enable: boolean) => {
    updateAutoApproveActive(enable);
  };

  const hasEnabledOptions = Object.values(autoApproveSettings).some(Boolean);

  return (
    <div className="-mx-4 select-none">
      <div
        className={cn(
          "flex cursor-pointer items-center justify-between px-4 pt-2.5",
          {
            "py-2.5": !isOpen,
            "pt-2.5": isOpen,
            "border-t": isOpen,
          },
        )}
      >
        <div className="flex w-full overflow-x-hidden">
          <label
            htmlFor="auto-approve"
            className="flex shrink-0 cursor-pointer pt-1 pr-4"
          >
            <Checkbox
              id="auto-approve"
              checked={autoApproveActive}
              onCheckedChange={(checked) => {
                toggleActive(!!checked);
              }}
            />
          </label>
          <div
            className={cn(
              "flex flex-1 flex-nowrap items-center gap-1 overflow-hidden font-medium hover:text-foreground/80",
              {
                "pb-6": isOpen,
              },
            )}
            onClick={() => setIsOpen(!isOpen)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setIsOpen(!isOpen);
              }
            }}
          >
            <div className="flex-1 truncate">
              <span className="whitespace-nowrap">Auto-approve:</span>
              {autoApproveActive && enabledOptions.length > 0 ? (
                <span className="ml-1">{enabledOptions.join(", ")}</span>
              ) : (
                <span className="ml-1 text-[var(--vscode-descriptionForeground)]">
                  {hasEnabledOptions ? "Disabled" : "None"}
                </span>
              )}
            </div>
            <ChevronRight
              className={cn(
                "size-4 shrink-0 text-[var(--vscode-descriptionForeground)] transition-transform duration-100 ease-in-out",
                isOpen ? "rotate-90 transform" : "",
              )}
            />
          </div>
        </div>
      </div>

      <div
        className={cn(
          "origin-top overflow-hidden px-4 transition-all duration-100 ease-in-out",
          isOpen ? "max-h-[700px] opacity-100" : "max-h-0 scale-y-90 opacity-0",
        )}
      >
        <div className="rounded-md bg-[var(--vscode-editorWidget-background)] px-4 pt-2 pb-4 shadow-md">
          <p className="mb-4 text-muted-foreground text-sm">
            Auto-approve allows Pochi to perform actions without asking for
            permission. Only enable for actions you fully trust.
          </p>

          <div className="flex flex-wrap justify-center">
            <div className="mx-auto flex w-full max-w-full flex-wrap justify-center gap-3 sm:max-w-[600px] sm:gap-4 md:max-w-[800px] lg:max-w-[1000px]">
              <ToggleButton
                icon={<Eye />}
                label="Read"
                isActive={autoApproveSettings.read}
                onClick={() => handleToggle("read")}
              />

              <ToggleButton
                icon={<FileEdit />}
                label="Write"
                isActive={autoApproveSettings.write}
                onClick={() => handleToggle("write")}
              />

              <ToggleButton
                icon={<Play />}
                label="Execute"
                isActive={autoApproveSettings.execute}
                onClick={() => handleToggle("execute")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ToggleButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function ToggleButton({ icon, label, isActive, onClick }: ToggleButtonProps) {
  return (
    <Button
      className={cn(
        "flex flex-col items-center justify-center gap-3 border bg-transparent p-2 text-foreground transition-all duration-100 sm:gap-4 sm:p-3",
        "size-[80px]",
        isActive
          ? "bg-primary text-primary-foreground hover:bg-primary/70"
          : "hover:bg-secondary hover:text-secondary-foreground",
      )}
      onClick={onClick}
    >
      {icon}
      <div className="whitespace-nowrap font-medium text-sm sm:text-base">
        {label}
      </div>
    </Button>
  );
}
