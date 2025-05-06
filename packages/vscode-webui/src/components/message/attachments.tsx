import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import type { Attachment } from "ai";
import { FileIcon } from "lucide-react";

interface MessageAttachmentsProps {
  attachments: Attachment[];
}

export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="my-2 flex flex-wrap gap-2">
      {attachments.map((attachment, index) => {
        const isImage = attachment.contentType?.startsWith("image/");

        return (
          <HoverCard key={index} openDelay={300} closeDelay={200}>
            <div className="relative">
              <HoverCardTrigger asChild>
                <div
                  className={cn(
                    "flex items-center gap-1.5 p-1.5 text-xs rounded border bg-[var(--vscode-editorWidget-background)] hover:bg-[var(--vscode-list-hoverBackground)]",
                    "border hover:border-[var(--vscode-focusBorder)] cursor-pointer",
                  )}
                >
                  {isImage ? (
                    <>
                      <div className="w-5 h-5 overflow-hidden rounded-sm border border-[var(--vscode-input-border)]">
                        <img
                          src={attachment.url}
                          alt={attachment.name}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <span className="max-w-[100px] truncate">
                        {attachment.name}
                      </span>
                    </>
                  ) : (
                    <>
                      <FileIcon className="w-4 h-4 shrink-0 text-[var(--vscode-symbolIcon-fileForeground)]" />
                      <span className="max-w-[100px] truncate">
                        {attachment.name}
                      </span>
                    </>
                  )}
                </div>
              </HoverCardTrigger>
            </div>

            <HoverCardContent
              className="p-2 w-auto max-w-[95vw] max-h-[80vh]"
              align="start"
            >
              <div className="flex flex-col gap-2">
                <div className="text-xs font-medium truncate max-w-[300px]">
                  {attachment.name}
                </div>
                {isImage ? (
                  <div className="overflow-hidden rounded-md border border-[var(--vscode-input-border)]">
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="object-contain max-w-[90vw] h-auto"
                      style={{
                        maxHeight: "calc(60vh - 1rem)",
                        minWidth: "200px",
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <FileIcon className="w-5 h-5 text-[var(--vscode-symbolIcon-fileForeground)]" />
                    <span>{attachment.contentType}</span>
                  </div>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  );
}
