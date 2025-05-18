import { cn } from "@/lib/utils";
import { addLineBreak, isFolder } from "@/lib/utils/file";
import { vscodeHost } from "@/lib/vscode";
import { File, Folder } from "lucide-react";

interface FileBadgeProps {
  path: string;
  startLine?: number;
  endLine?: number;
  onClick?: () => void;
  className?: string;
}

export const FileIcon: React.FC<{ path: string; className?: string }> = ({
  path,
  className,
}) => {
  return isFolder(path) ? (
    <Folder className={className} />
  ) : (
    <File className={className} />
  );
};

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
    <span
      onClick={(e) => {
        e.stopPropagation();
        onClick ? onClick() : defaultOnClick();
      }}
      className={cn(
        "cursor-pointer rounded-sm border border-border box-decoration-clone px-1 py-0.5 text-sm hover:bg-zinc-200 active:bg-zinc-200 dark:active:bg-zinc-700 dark:hover:bg-zinc-700",
        className,
      )}
    >
      <FileIcon
        path={path}
        className="inline size-3 text-blue-600 dark:text-blue-400"
      />
      <span className="ml-1 break-words">
        {addLineBreak(path)}
        <span className="text-zinc-500 dark:text-zinc-400">{lineRange}</span>
      </span>
    </span>
  );
};
