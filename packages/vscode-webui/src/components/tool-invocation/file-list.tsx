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
          className={`cursor-pointer truncate rounded p-1 ${activeIndex === index ? "bg-secondary" : "hover:bg-secondary/50"}`}
          title={match.context}
          onClick={() => {
            setActiveIndex(index);
            vscodeHost.openFile(match.file, { start: match.line });
          }}
        >
          <span
            className={`truncate px-1 font-semibold ${activeIndex === index ? "text-secondary-foreground" : "text-foreground"}`}
          >
            <FileIcon
              path={match.file}
              className="mr-1.5 mb-0.5 inline size-3"
            />
            {getFileName(match.file)}
            {match.line && (
              <span
                className={`truncate ${activeIndex === index ? "text-secondary-foreground/70" : "text-foreground/70"}`}
              >
                :{match.line}
              </span>
            )}
          </span>
          <span
            title={match.file}
            className={`${activeIndex === index ? "text-secondary-foreground/70" : "text-foreground/70"}`}
          >
            {match.file}
          </span>
        </div>
      ))}
    </ScrollArea>
  );
};
