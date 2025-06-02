import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Blocks,
  Eye,
  FileEdit,
  type LucideIcon,
  RotateCcw,
  Terminal,
} from "lucide-react";
import { type AutoApprove, useSettingsStore } from "../store";

interface CoreActionSetting {
  id: keyof Omit<AutoApprove, "default">;
  label: string;
  iconClass: LucideIcon;
  summary: string;
}

export function AutoApproveMenu() {
  const {
    autoApproveActive,
    updateAutoApproveActive,
    autoApproveSettings,
    updateAutoApproveSettings,
  } = useSettingsStore();
  const coreActionSettings: CoreActionSetting[] = [
    {
      id: "read",
      summary: "Read",
      label: "Read files",
      iconClass: Eye,
    },
    {
      id: "write",
      summary: "Write",
      label: "Edit files",
      iconClass: FileEdit,
    },
    {
      id: "execute",
      summary: "Execute",
      label: "Execute commands",
      iconClass: Terminal,
    },
    {
      id: "retry",
      summary: "Retry",
      label: "Retry actions",
      iconClass: RotateCcw,
    },
    { id: "mcp", summary: "MCP", label: "Use MCP servers", iconClass: Blocks },
  ];

  const handleCoreActionToggle = (
    id: keyof Omit<AutoApprove, "default">,
    checked: boolean,
  ) => {
    if (id === "retry") {
      updateAutoApproveSettings({ retry: checked ? 5 : 0 });
    } else {
      updateAutoApproveSettings({ [id]: checked });
    }
    if (checked && !autoApproveActive) {
      updateAutoApproveActive(true);
    }
  };

  const getCoreActionCheckedState = (
    id: keyof Omit<AutoApprove, "default">,
  ): boolean => {
    if (id === "retry") {
      return autoApproveSettings.retry > 0;
    }
    return !!autoApproveSettings[id];
  };

  const enabledOptionsSummary = coreActionSettings
    .filter((setting) => getCoreActionCheckedState(setting.id))
    .map((setting) => setting.summary);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "relative mt-2 flex cursor-pointer select-none items-center justify-between py-2.5",
          )}
        >
          <div className="flex w-full overflow-x-hidden">
            <label
              htmlFor="auto-approve-main-checkbox-trigger-dialog"
              className="flex shrink-0 cursor-pointer items-center pr-3"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                id="auto-approve-main-checkbox-trigger-dialog"
                checked={autoApproveActive}
                onCheckedChange={(checked) => {
                  updateAutoApproveActive(!!checked);
                }}
              />
            </label>
            <div className="flex flex-1 flex-nowrap items-center gap-1 overflow-hidden font-medium hover:text-foreground/80">
              <div className="flex-1 truncate">
                <span className="whitespace-nowrap">Auto-approve:</span>
                {autoApproveActive && enabledOptionsSummary.length > 0 ? (
                  <span className="ml-1">
                    {enabledOptionsSummary.join(", ")}
                  </span>
                ) : (
                  <span className="ml-1 text-[var(--vscode-descriptionForeground)]">
                    {autoApproveActive ? "No actions selected" : "Disabled"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="grid grid-cols-1 gap-2.5 [@media(min-width:400px)]:w-[400px] [@media(min-width:400px)]:grid-cols-2"
        side="top"
      >
        {coreActionSettings.map((setting) => (
          <div key={setting.id} className="flex items-center">
            <label
              htmlFor={`core-action-dialog-${setting.id}`}
              className={cn(
                "flex flex-1 cursor-pointer select-none items-center text-foreground text-sm",
                !autoApproveActive && "cursor-not-allowed opacity-60",
              )}
            >
              <Checkbox
                id={`core-action-dialog-${setting.id}`}
                checked={getCoreActionCheckedState(setting.id)}
                onCheckedChange={(checked) =>
                  handleCoreActionToggle(setting.id, !!checked)
                }
                disabled={!autoApproveActive}
              />
              <span className="ml-4 flex items-center gap-2 font-semibold">
                <setting.iconClass className="size-4 shrink-0" />
                {setting.label}
              </span>
            </label>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
