import { FileList } from "@/components/tool-invocation/file-list";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { vscodeHost } from "@/lib/vscode";
import type { RuleFile } from "@ragdoll/vscode-webui-bridge";
import { useEffect, useState } from "react";
import { Progress } from "./ui/progress";

interface Props {
  contextWindow: number;
  totalTokens: number;
  className?: string;
}

export function TokenUsage({ totalTokens, contextWindow, className }: Props) {
  const percentage = Math.ceil((totalTokens / contextWindow) * 100);
  const [ruleFiles, setRuleFiles] = useState<RuleFile[]>([]);

  useEffect(() => {
    vscodeHost.listRuleFiles().then(setRuleFiles);
  }, []);

  return (
    <Popover>
      <PopoverTrigger>
        <div
          className={cn(
            "overflow-x-hidden text-muted-foreground text-xs",
            className,
          )}
        >
          <span className="select-none whitespace-nowrap font-medium">
            {percentage}% of {formatTokens(contextWindow)} tokens
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 border">
        <div className="flex flex-col gap-y-4 text-xs">
          {ruleFiles.length > 0 && (
            <div className="flex flex-col gap-y-1">
              <div className="mb-1 text-muted-foreground">Rules</div>
              <div>
                <FileList
                  matches={ruleFiles.map((item) => ({
                    file: item.relativeFilepath ?? item.filepath,
                    label: item.label,
                  }))}
                  showBaseName={false}
                />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-y-1">
            <div className="mb-1 text-muted-foreground">Context Window</div>
            <div>
              <Progress value={percentage} className="mb-1" />
              {formatTokens(totalTokens)} of {formatTokens(contextWindow)} used
            </div>
          </div>
          {/* <div className="mt-2 flex items-center gap-x-2">
            <Button variant="outline" size="sm" className="text-xs">
              New Task with Summary
            </Button>
            <Button variant="outline" size="sm" className="text-xs">
              Compact Task
            </Button>
          </div> */}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function formatTokens(tokens: number | null | undefined): string {
  if (tokens == null || tokens === 0) {
    return "0";
  }
  const k = 1000;
  const m = k * 1000;
  const g = m * 1000;
  // Add T, P, E if needed

  let value: number;
  let unit: string;

  if (tokens >= g) {
    value = tokens / g;
    unit = "G";
  } else if (tokens >= m) {
    value = tokens / m;
    unit = "M";
  } else if (tokens >= k) {
    value = tokens / k;
    unit = "k";
  } else {
    return tokens.toString(); // Return the number as is if less than 1k
  }

  // Format to one decimal place
  let formattedValue = value.toFixed(1);

  // If it ends with .0, remove .0
  if (formattedValue.endsWith(".0")) {
    formattedValue = formattedValue.substring(0, formattedValue.length - 2);
  }

  return `${formattedValue}${unit}`;
}
