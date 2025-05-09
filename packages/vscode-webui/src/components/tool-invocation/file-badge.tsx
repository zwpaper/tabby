import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { vscodeHost } from "@/lib/vscode";
import { File } from "lucide-react";

interface FileBadgeProps {
  path: string;
  startLine?: number;
  endLine?: number;
  onClick?: () => void;
  className?: string;
}

const getBasename = (path: string): string => path.split(/[\\/]/).pop() || "";

export const FileBadge: React.FC<FileBadgeProps> = ({
  path,
  startLine,
  endLine,
  onClick,
  className,
}) => {
  const lineRange = startLine
    ? endLine
      ? `:${startLine}-${endLine}`
      : `:${startLine}`
    : "";
  const defaultOnClick = () => {
    vscodeHost.openFile(
      path,
      startLine ? { start: startLine, end: endLine } : undefined,
    );
  };
  return (
    <Tooltip delayDuration={700}>
      <TooltipTrigger asChild>
        <span
          onClick={onClick || defaultOnClick}
          className={cn(
            "cursor-pointer rounded-sm border border-zinc-600 box-decoration-clone px-1 py-0.5 text-xs active:bg-zinc-700",
            className,
          )}
        >
          <File className="inline-block size-3" />
          <span className="ml-1">
            {getBasename(path)}
            <span className="text-zinc-400">{lineRange}</span>
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="rounded bg-secondary px-1 py-0.5"
      >
        <p>{path}</p>
      </TooltipContent>
    </Tooltip>
  );
};
