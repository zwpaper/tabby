import { vscodeHost } from "@/lib/vscode";
import { File } from "lucide-react";

interface FileBadgeProps {
  path: string;
  startLine?: number;
  endLine?: number;
}

export const FileBadge: React.FC<FileBadgeProps> = ({
  path,
  startLine,
  endLine,
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
    <button
      type="button"
      onClick={onClick}
      className="text-zinc-400 text-xs border border-zinc-600 rounded-sm px-1 inline-flex items-center gap-1 active:bg-zinc-700"
    >
      <File className="size-3" />
      {path}
      {lineRange}
    </button>
  );
};
