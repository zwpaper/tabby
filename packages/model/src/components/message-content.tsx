import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import type { Part } from "../types";

interface MessageContentProps {
  role: "user" | "assistant" | "system";
  content: Part;
  taskUid: string;
  messageIndex: number;
  editingPart: {
    taskUid: string;
    messageIndex: number;
    partIndex: number | null;
  } | null;
  editedContent: string;
  onEdit: (
    taskUid: string,
    messageIndex: number,
    partIndex: number | null,
    content: string,
  ) => void;
  onSave: () => void;
  onCancel: () => void;
  onRemovePart: (
    taskUid: string,
    messageIndex: number,
    partIndex: number,
  ) => void;
  onEditedContentChange: (content: string) => void;
}

function MessageContentInternal({
  content,
  taskUid,
  messageIndex,
  editingPart,
  editedContent,
  onEdit,
  onSave,
  onCancel,
  onRemovePart,
  onEditedContentChange,
}: Omit<MessageContentProps, "role">) {
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const isEditing =
    editingPart?.taskUid === taskUid &&
    editingPart?.messageIndex === messageIndex;

  const handleCopy = (data: Part | { type: "text"; text: string }) => {
    const dataToCopy =
      typeof data === "object" &&
      data !== null &&
      !Array.isArray(data) &&
      "type" in data &&
      data.type === "text"
        ? (data as { text: string }).text
        : data;
    navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2000);
  };

  if (typeof content === "string") {
    const isEditingThis = isEditing && editingPart?.partIndex === null;
    if (isEditingThis) {
      return (
        <div className="space-y-2">
          <TextareaAutosize
            value={editedContent}
            onChange={(e) => onEditedContentChange(e.target.value)}
            className="w-full resize-y rounded-md border border-input bg-background p-2 shadow-sm focus:border-ring"
            minRows={6}
            maxRows={16}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              className="inline-flex items-center justify-center rounded-md bg-green-600 px-3 py-1.5 font-medium text-foreground text-xs shadow-sm transition-colors hover:bg-green-700 focus:outline-none"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center rounded-md border bg-background px-3 py-1.5 font-medium text-foreground text-xs shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(taskUid, messageIndex, null, content)}
            className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs shadow-sm transition-colors hover:bg-primary/90 focus:outline-none"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => handleCopy(content)}
            className="inline-flex items-center justify-center rounded-md border bg-background px-3 py-1.5 font-medium text-foreground text-xs shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
          >
            {copiedFeedback ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre
          className="whitespace-pre-wrap rounded-md border bg-muted/50 p-3 text-sm"
          style={{ maxHeight: "10vh", overflowY: "auto" }}
        >
          {content}
        </pre>
      </div>
    );
  }

  if (Array.isArray(content)) {
    return (
      <div className="space-y-4">
        {content.map((part, partIndex) => {
          const isEditingThis =
            isEditing && editingPart?.partIndex === partIndex;
          return (
            <div key={partIndex} className="rounded-md border bg-muted/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <strong className="font-semibold text-muted-foreground text-sm uppercase">
                  {part.type}
                </strong>
                <div className="flex items-center gap-2">
                  {isEditingThis ? (
                    <>
                      <button
                        type="button"
                        onClick={onSave}
                        className="inline-flex items-center justify-center rounded-md bg-green-600 px-3 py-1.5 font-medium text-foreground text-xs shadow-sm transition-colors hover:bg-green-700 focus:outline-none"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={onCancel}
                        className="inline-flex items-center justify-center rounded-md border bg-background px-3 py-1.5 font-medium text-foreground text-xs shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          onEdit(taskUid, messageIndex, partIndex, part.text)
                        }
                        className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs shadow-sm transition-colors hover:bg-primary/90 focus:outline-none"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(part)}
                        className="inline-flex items-center justify-center rounded-md border bg-background px-3 py-1.5 font-medium text-foreground text-xs shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
                      >
                        {copiedFeedback ? "Copied!" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onRemovePart(taskUid, messageIndex, partIndex)
                        }
                        className="inline-flex items-center justify-center rounded-md border bg-background px-3 py-1.5 font-medium text-foreground text-xs shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
                      >
                        Remove Part
                      </button>
                    </>
                  )}
                </div>
              </div>
              {isEditingThis ? (
                <TextareaAutosize
                  value={editedContent}
                  onChange={(e) => onEditedContentChange(e.target.value)}
                  className="w-full resize-y rounded-md border border-input bg-background p-2 shadow-sm focus:border-ring"
                  minRows={6}
                  maxRows={16}
                />
              ) : (
                <pre
                  className="whitespace-pre-wrap rounded-md border bg-background p-3 text-sm"
                  style={{ maxHeight: "25vh", overflowY: "auto" }}
                >
                  {part.text}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => handleCopy(content)}
        className="mb-2 inline-flex items-center justify-center rounded-md border bg-background px-3 py-1.5 font-medium text-foreground text-xs shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
      >
        {copiedFeedback ? "Copied!" : "Copy"}
      </button>
      <pre
        className="whitespace-pre-wrap rounded-md border bg-muted/50 p-3 text-sm"
        style={{ maxHeight: "25vh", overflowY: "auto" }}
      >
        {JSON.stringify(content, null, 2)}
      </pre>
    </div>
  );
}

export function MessageContent(props: MessageContentProps) {
  const [isSystemContentVisible, setSystemContentVisible] = useState(false);

  if (props.role === "system") {
    return (
      <div>
        <div className="flex justify-end pb-2">
          <button
            type="button"
            onClick={() => setSystemContentVisible((x) => !x)}
            className="inline-flex items-center justify-center gap-1 rounded-md border bg-background px-3 py-1.5 font-medium text-foreground text-xs shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
          >
            {isSystemContentVisible ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            <span>{isSystemContentVisible ? "Hide" : "Show"}</span>
          </button>
        </div>
        {isSystemContentVisible && <MessageContentInternal {...props} />}
      </div>
    );
  }

  return <MessageContentInternal {...props} />;
}
