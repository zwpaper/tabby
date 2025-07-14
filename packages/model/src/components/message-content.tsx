import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
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
          <textarea
            value={editedContent}
            onChange={(e) => onEditedContentChange(e.target.value)}
            className="min-h-[150px] w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              className="rounded-md bg-green-600 px-3 py-1 font-medium text-white text-xs shadow-sm transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md bg-gray-200 px-3 py-1 font-medium text-gray-700 text-xs shadow-sm transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
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
            className="rounded-md bg-blue-600 px-3 py-1 font-medium text-white text-xs shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => handleCopy(content)}
            className="rounded-md bg-gray-500 px-3 py-1 font-medium text-white text-xs shadow-sm transition-colors hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            {copiedFeedback ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
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
            <div
              key={partIndex}
              className="rounded-md border border-gray-200 bg-gray-50 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <strong className="font-semibold text-gray-600 text-sm uppercase">
                  {part.type}
                </strong>
                <div className="flex items-center gap-2">
                  {isEditingThis ? (
                    <>
                      <button
                        type="button"
                        onClick={onSave}
                        className="rounded-md bg-green-600 px-3 py-1 font-medium text-white text-xs shadow-sm transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-md bg-gray-200 px-3 py-1 font-medium text-gray-700 text-xs shadow-sm transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
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
                        className="rounded-md bg-blue-600 px-3 py-1 font-medium text-white text-xs shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(part)}
                        className="rounded-md bg-gray-500 px-3 py-1 font-medium text-white text-xs shadow-sm transition-colors hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                      >
                        {copiedFeedback ? "Copied!" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onRemovePart(taskUid, messageIndex, partIndex)
                        }
                        className="rounded-md bg-red-500 px-3 py-1 font-medium text-white text-xs shadow-sm transition-colors hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      >
                        Remove Part
                      </button>
                    </>
                  )}
                </div>
              </div>
              {isEditingThis ? (
                <textarea
                  value={editedContent}
                  onChange={(e) => onEditedContentChange(e.target.value)}
                  className="min-h-[150px] w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              ) : (
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-gray-200 bg-white p-3 text-sm">
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
        className="mb-2 rounded-md bg-gray-500 px-3 py-1 font-medium text-white text-xs shadow-sm transition-colors hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      >
        {copiedFeedback ? "Copied!" : "Copy"}
      </button>
      <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
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
            className="flex items-center gap-1 rounded-md bg-gray-200 px-3 py-1 font-medium text-gray-700 text-xs shadow-sm transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
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
