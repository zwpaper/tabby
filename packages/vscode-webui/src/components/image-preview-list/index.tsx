import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface ImagePreviewListProps {
  files: File[];
  onRemove: (index: number) => void;
  uploadingFiles?: Record<string, boolean>;
  uploadResults?: Record<string, "success" | "error">;
}

export function ImagePreviewList({
  files,
  onRemove,
  uploadingFiles = {},
  uploadResults = {},
}: ImagePreviewListProps) {
  const [previews, setPreviews] = useState<string[]>([]);

  // Generate previews for images when files change
  // biome-ignore lint/correctness/useExhaustiveDependencies: ignore
  useEffect(() => {
    // Clean up previous previews to avoid memory leaks
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
        // todo util to generate file id
        const fileId = `${file.name}-${file.size}`;
        const isUploading = uploadingFiles[fileId];
        const result = uploadResults[fileId];

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
                      <Loader2 className="size-6 text-white animate-spin" />
                      <span className="text-white text-[10px] mt-1">
                        Uploading
                      </span>
                    </div>
                  )}

                  {/* Success/Error indicator */}
                  {result === "success" && (
                    <div className="absolute bottom-1 right-1">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                  )}
                  {result === "error" && (
                    <div className="absolute bottom-1 right-1">
                      <XCircle className="w-4 h-4 text-red-500" />
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
            <HoverCardContent className="p-2 w-auto max-w-[80vw] max-h-[80vh]">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="text-xs font-medium truncate max-w-[300px]">
                    {file.name}
                  </div>
                  {isUploading && (
                    <div className="flex items-center gap-1 text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Uploading...</span>
                    </div>
                  )}
                </div>

                <div className="overflow-hidden rounded-md border border-[var(--vscode-input-border)]">
                  {previews[index] && (
                    <img
                      src={previews[index]}
                      alt={file.name}
                      className="object-contain max-h-[60vh] max-w-[60vw]"
                    />
                  )}
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
