import { cn } from "@/lib/utils";
import { vscodeHost } from "@/lib/vscode";
import { File } from "lucide-react";

interface FileBadgeProps {
  path: string;
  startLine?: number;
  endLine?: number;
  className?: string;
}

export const FileBadge: React.FC<FileBadgeProps> = ({
  path,
  startLine,
  endLine,
  className,
}) => {
  const lineRange = startLine
    ? endLine
      ? `:${startLine}-${endLine}`
      : `:${startLine}`
    : "";
  const onClick = () => {
    vscodeHost.openFile(
      path,
      startLine ? { start: startLine, end: endLine } : undefined,
    );
  };
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: only handle onClick
    <span
      onClick={onClick}
      className={cn(
        "inline-block cursor-pointer rounded-sm border border-zinc-600 px-1 text-xs active:bg-zinc-700",
        className,
      )}
    >
      <File className="inline-block size-3" />
      <span className="ml-1">
        {path}
        <span className="text-zinc-400">{lineRange}</span>
      </span>
    </span>
  );
};
