import { useState } from "react";

interface Attachment {
  name: string;
  contentType: string;
  url: string;
}

interface MessageAttachmentsProps {
  attachments: Attachment[];
}

export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment, index) => {
        if (attachment.contentType.startsWith("image/")) {
          return (
            <div key={index} className="relative">
              <img
                src={attachment.url}
                alt={attachment.name}
                className="h-24 w-24 cursor-pointer rounded-md object-cover"
                onClick={() => setExpandedImage(attachment.url)}
              />
              {expandedImage === attachment.url && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
                  onClick={() => setExpandedImage(null)}
                >
                  <div className="relative max-h-[90vh] max-w-[90vw]">
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="max-h-[90vh] max-w-[90vw] object-contain"
                    />
                    <button
                      type="button"
                      className="absolute top-2 right-2 rounded-full bg-black/50 p-2 text-white"
                      onClick={() => setExpandedImage(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        }
        return (
          <a
            key={index}
            href={attachment.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md border border-gray-300 bg-white p-2 text-sm"
          >
            <span>{attachment.name}</span>
          </a>
        );
      })}
    </div>
  );
}
