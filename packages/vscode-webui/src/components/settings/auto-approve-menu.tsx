import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { cn } from "@/lib/utils";
import { ToolsByPermission } from "@ragdoll/tools";
import { ChevronDown, Eye, FileEdit, Play } from "lucide-react";
import { useState } from "react";

export function AutoApproveMenu() {
  const { autoApproveSettings, updateAutoApproveSettings } = useSettingsStore();
  const [isOpen, setIsOpen] = useState(false);

  // Create a list of enabled options for the title
  const enabledOptions = Object.entries(autoApproveSettings)
    .filter(([_, value]) => value)
    .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1));

  const handleToggle = (key: keyof typeof autoApproveSettings) => {
    updateAutoApproveSettings({ [key]: !autoApproveSettings[key] });
  };

  const toggleAll = (enable: boolean) => {
    const newSettings = Object.keys(ToolsByPermission).reduce(
      (acc, key) => {
        acc[key as keyof typeof autoApproveSettings] = enable;
        return acc;
      },
      {} as typeof autoApproveSettings,
    );

    updateAutoApproveSettings(newSettings);
  };

  return (
    <div className="-mx-4">
      <div
        className={cn(
          "flex items-center justify-between cursor-pointer py-2.5 px-4",
          {
            "border-t": isOpen,
          },
        )}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setIsOpen(!isOpen);
          }
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={Object.values(autoApproveSettings).some(Boolean)}
              onCheckedChange={(checked) => {
                toggleAll(!!checked);
              }}
            />
          </div>
          <span className="font-medium">
            Auto-approve:
            {enabledOptions.length > 0 ? (
              <span className="ml-1 text-[var(--vscode-foreground)]">
                {enabledOptions.join(", ")}
              </span>
            ) : (
              <span className="ml-1 text-[var(--vscode-descriptionForeground)]">
                None
              </span>
            )}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "size-4 transition-transform duration-100 ease-in-out text-[var(--vscode-descriptionForeground)]",
            isOpen ? "transform rotate-180" : "",
          )}
        />
      </div>

      <div
        className={cn(
          "overflow-hidden transition-all duration-100 ease-in-out origin-top px-4",
          isOpen ? "max-h-[700px] opacity-100" : "max-h-0 opacity-0 scale-y-90",
        )}
      >
        <div className="rounded-md bg-[var(--vscode-editorWidget-background)] shadow-md pt-2 pb-4 px-4">
          <p className="text-sm text-muted-foreground mb-4">
            Auto-approve allows Pochi to perform actions without asking for
            permission. Only enable for actions you fully trust.
          </p>

          <div className="flex flex-wrap justify-center">
            <div className="flex flex-wrap justify-center w-full max-w-full sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px] mx-auto gap-3 sm:gap-4">
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
        "bg-transparent flex flex-col items-center justify-center gap-3 sm:gap-4 p-2 sm:p-3 transition-all duration-100 border",
        "size-[80px]",
        isActive
          ? "bg-primary text-primary-foreground hover:bg-primary/70"
          : "hover:bg-secondary hover:text-secondary-foreground",
      )}
      onClick={onClick}
    >
      {icon}
      <div className="text-sm sm:text-base font-medium whitespace-nowrap">
        {label}
      </div>
    </Button>
  );
}
