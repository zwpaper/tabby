import { ScrollArea } from "@/components/ui/scroll-area";
import { getFileName } from "@/lib/utils/file";
import { vscodeHost } from "@/lib/vscode";
import { useState } from "react";
import { FileIcon } from "./file-badge";

export const FileList: React.FC<{
  matches: { file: string; line?: number; context?: string }[];
}> = ({ matches }) => {
  const [activeIndex, setActiveIndex] = useState(-1);
  if (matches.length === 0) {
    return null;
  }
  return (
    <ScrollArea className="flex max-h-[100px] flex-col gap-1 rounded border p-1">
      {matches.map((match, index) => (
        <div
          key={match.file + (match.line ?? "") + index}
          className={`flex cursor-pointer items-center gap-2 rounded p-1 ${activeIndex === index ? "bg-border" : "hover:bg-muted"}`}
          title={match.context}
          onClick={() => {
            setActiveIndex(index);
            vscodeHost.openFile(match.file, { start: match.line });
          }}
        >
          <FileIcon path={match.file} className="size-3 shrink-0" />
          <span className="whitespace-nowrap font-semibold text-gray-300">
            {getFileName(match.file)}
            {match.line && <span className="text-gray-500">:{match.line}</span>}
          </span>
          <span
            title={match.file}
            className="overflow-hidden text-ellipsis whitespace-nowrap text-gray-500"
          >
            {match.file}
          </span>
        </div>
      ))}
    </ScrollArea>
  );
};
