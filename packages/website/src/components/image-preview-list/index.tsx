import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { X } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";

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
  useEffect(() => {
    // Generate new previews
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setPreviews(newPreviews);

    // Cleanup function to revoke URLs when component unmounts or files change
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
    <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {files.map((file, index) => {
        const fileId = `${file.name}-${file.size}`;
        const isUploading = uploadingFiles[fileId];
        const fileSizeInKB = (file.size / 1024).toFixed(2);

        return (
          <HoverCard key={index} openDelay={300} closeDelay={100}>
            <HoverCardTrigger asChild>
              <div className="relative flex w-full items-center rounded-md border border-gray-200 bg-gray-50 p-2">
                <div className="mr-2 h-8 w-8 flex-shrink-0 overflow-hidden rounded-sm">
                  {previews[index] && (
                    <img
                      src={previews[index]}
                      alt={file.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                  <div className="truncate text-gray-700 text-sm">
                    {file.name}
                  </div>
                  <div className="text-gray-500 text-xs">{fileSizeInKB}kB</div>
                </div>
                {isUploading ? (
                  <div className="ml-2 flex flex-shrink-0 items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-2 h-6 w-6 flex-shrink-0 rounded-full p-0 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemove(index);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </HoverCardTrigger>
            <HoverCardContent
              className="flex w-auto items-center justify-center p-2"
              side="top"
              align="center"
              sideOffset={5}
            >
              <div className="relative max-h-[80vh] max-w-[80vw] overflow-auto">
                {previews[index] && (
                  <img
                    src={previews[index]}
                    alt={file.name}
                    className="rounded-md object-contain"
                    style={{ maxWidth: "500px", maxHeight: "500px" }}
                  />
                )}
                <div className="absolute right-2 bottom-2 rounded bg-black/70 px-2 py-1 text-white text-xs">
                  {file.name} ({fileSizeInKB}kB)
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  );
}
