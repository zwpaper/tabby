import { cn } from "@/lib/utils";
import { addLineBreak } from "@/lib/utils/file";
import { vscodeHost } from "@/lib/vscode";
import { FileIcon } from "./file-icon/file-icon";

interface FileBadgeProps {
  label?: string;
  path: string;
  startLine?: number;
  endLine?: number;
  onClick?: () => void;
  className?: string;
}

export const FileBadge: React.FC<FileBadgeProps> = ({
  label,
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
    <span
      onClick={(e) => {
        e.stopPropagation();
        onClick ? onClick() : defaultOnClick();
      }}
      className={cn(
        "cursor-pointer rounded-sm border border-border box-decoration-clone p-0.5 text-sm/6 hover:bg-zinc-200 active:bg-zinc-200 dark:active:bg-zinc-700 dark:hover:bg-zinc-700",
        className,
      )}
    >
      <FileIcon path={path} />
      <span className="ml-0.5 break-words">
        {addLineBreak(label || path)}
        <span className="text-zinc-500 dark:text-zinc-400">{lineRange}</span>
      </span>
    </span>
  );
};
