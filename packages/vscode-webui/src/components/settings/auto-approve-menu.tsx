import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  type AutoApprove,
  useSettingsStore,
} from "@/lib/stores/settings-store";
import { cn } from "@/lib/utils";
import { ChevronLeft, Eye, FileEdit, Play, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

const collapsibleSectionVariants = {
  open: {
    height: "auto",
    transition: { duration: 0.1, ease: "easeOut" },
  },
  collapsed: {
    height: 0,
    transition: { duration: 0.1, ease: "easeIn" },
  },
};

interface ToggleButtonConfig {
  key: Exclude<keyof AutoApprove, "default">;
  label: string;
  icon: React.ReactNode;
}

export function AutoApproveMenu() {
  const {
    autoApproveActive,
    updateAutoApproveActive,
    autoApproveSettings,
    updateAutoApproveSettings,
  } = useSettingsStore();
  const [isOpen, setIsOpen] = useState(false);

  const orderedToggleButtons: ToggleButtonConfig[] = [
    { key: "read", label: "Read", icon: <Eye /> },
    { key: "write", label: "Write", icon: <FileEdit /> },
    { key: "execute", label: "Execute", icon: <Play /> },
    { key: "retry", label: "Retry", icon: <RotateCcw /> },
  ];

  const enabledOptions = orderedToggleButtons
    .filter(({ key }) => autoApproveSettings[key])
    .map((x) => x.label);

  const handleToggle = (key: ToggleButtonConfig["key"]) => {
    if (key === "retry") {
      if (autoApproveSettings.retry > 0) {
        updateAutoApproveSettings({ retry: 0 });
      } else {
        updateAutoApproveSettings({ retry: 5 });
      }
    } else {
      updateAutoApproveSettings({ [key]: !autoApproveSettings[key] });
    }
  };

  const toggleActive = (enable: boolean) => {
    updateAutoApproveActive(enable);
  };

  const hasEnabledOptions = Object.values(autoApproveSettings).some(Boolean);

  return (
    <div className="mt-2 select-none">
      {isOpen && <div className="-mx-4 h-0 border-t" />}

      <div
        className={cn(
          "flex cursor-pointer items-center justify-between pt-2.5",
          {
            "py-2.5": !isOpen,
            "pt-2.5": isOpen,
          },
        )}
      >
        <div className="flex w-full overflow-x-hidden">
          <label
            htmlFor="auto-approve"
            className="flex shrink-0 cursor-pointer pt-0.5 pr-3"
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
            <ChevronLeft
              className={cn(
                "size-4 shrink-0 text-[var(--vscode-descriptionForeground)] transition-transform duration-100 ease-in-out",
                isOpen ? "-rotate-90 transform" : "",
              )}
            />
          </div>
        </div>
      </div>

      <motion.div
        initial={false}
        animate={isOpen ? "open" : "collapsed"}
        variants={collapsibleSectionVariants}
        className="overflow-hidden"
      >
        <div className="rounded-md bg-[var(--vscode-editorWidget-background)] px-4 pt-2 pb-4 shadow-md">
          <p className="mb-4 text-muted-foreground text-sm">
            Auto-approve allows Pochi to perform actions without asking for
            permission. Only enable for actions you fully trust.
          </p>

          <div className="flex flex-wrap justify-center">
            <div className="mx-auto flex w-full max-w-full flex-wrap justify-center gap-3 sm:max-w-[600px] sm:gap-4 md:max-w-[800px] lg:max-w-[1000px]">
              {orderedToggleButtons.map(({ key, label, icon }) => {
                const isActive =
                  key === "retry"
                    ? autoApproveSettings.retry > 0
                    : autoApproveSettings[key];

                return (
                  <ToggleButton
                    key={key}
                    icon={icon}
                    label={label}
                    isActive={isActive}
                    onClick={() => handleToggle(key)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
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
        "flex flex-col items-center justify-center gap-3 border bg-transparent p-2 text-foreground sm:gap-4 sm:p-3",
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
