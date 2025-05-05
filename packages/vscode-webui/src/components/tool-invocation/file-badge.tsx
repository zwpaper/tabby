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
      ? ` : ${startLine}-${endLine}`
      : ` : ${startLine}`
    : "";
  const onClick = () => {
    vscodeHost.openFile(path);
  };
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: only handle onClick
    <span
      onClick={onClick}
      className={cn(
        "text-zinc-400 active:bg-zinc-700 text-xs border border-zinc-600 rounded-sm px-1 cursor-pointer inline-block",
        className,
      )}
    >
      <File className="size-3 inline-block" />
      <span className="ml-1">
        {path}
        {lineRange}
      </span>
    </span>
  );
};
