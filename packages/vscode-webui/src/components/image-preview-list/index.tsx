import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { generateFileId } from "@/lib/utils/image";
import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

interface ImagePreviewListProps {
  files: File[];
  onRemove: (index: number) => void;
  uploadingFiles?: Record<string, boolean>;
}

export function ImagePreviewList({
  files,
  onRemove,
  uploadingFiles = {},
}: ImagePreviewListProps) {
  const [previews, setPreviews] = useState<string[]>([]);

  // Generate previews for images when files change
  // biome-ignore lint/correctness/useExhaustiveDependencies: ignore
  useEffect(() => {
    if (previews.length > 0) {
      for (const preview of previews) {
        if (preview.startsWith("blob:")) {
          URL.revokeObjectURL(preview);
        }
      }
    }

    // Generate new previews
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setPreviews(newPreviews);

    // Cleanup function to revoke URLs when component unmounts
    return () => {
      for (const preview of newPreviews) {
        if (preview.startsWith("blob:")) {
          URL.revokeObjectURL(preview);
        }
      }
    };
  }, [files]);

  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2 mb-3">
      {files.map((file, index) => {
        const fileId = generateFileId(file);
        const isUploading = uploadingFiles[fileId];

        return (
          <HoverCard key={index} openDelay={300} closeDelay={200}>
            <div className="relative group">
              <HoverCardTrigger asChild>
                <div
                  className={cn(
                    "relative w-16 h-16 rounded-md border overflow-hidden cursor-pointer",
                    "border-[var(--vscode-input-border)] hover:border-[var(--vscode-focusBorder)]",
                  )}
                >
                  {previews[index] && (
                    <img
                      src={previews[index]}
                      alt={file.name}
                      className={cn(
                        "object-cover w-full h-full",
                        isUploading && "opacity-50",
                      )}
                    />
                  )}

                  {/* Overlay for uploading status */}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black bg-opacity-30 flex flex-col items-center justify-center">
                      <Loader2 className="size-4 text-white animate-spin" />
                    </div>
                  )}
                </div>
              </HoverCardTrigger>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className={cn(
                  "absolute -top-1 -right-1 bg-secondary text-secondary-foreground",
                  "rounded-full p-0.5 opacity-70 hover:opacity-100 transition-opacity",
                  "flex items-center justify-center w-5 h-5 text-xs",
                )}
                aria-label="Remove image"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <HoverCardContent className="p-2 w-auto max-w-[95vw] max-h-[80vh]">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="text-xs font-medium truncate max-w-[300px]">
                    {file.name}
                  </div>
                  {isUploading && (
                    <div className="flex items-center gap-1 text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="overflow-hidden rounded-md border border-[var(--input-border)]">
                  <div className="relative flex items-center justify-center">
                    {previews[index] && (
                      <img
                        src={previews[index]}
                        alt={file.name}
                        className="object-contain max-w-[90vw] h-auto"
                        style={{
                          maxHeight: "calc(60vh - 1rem)",
                          minWidth: "200px",
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="text-xs text-[var(--vscode-descriptionForeground)]">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  );
}
