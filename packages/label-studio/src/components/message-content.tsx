import { GitCompare } from "lucide-react";
import { forwardRef, useEffect, useState } from "react";
import ReactDiffViewer from "react-diff-viewer-continued";
import TextareaAutosize from "react-textarea-autosize";
import { useTheme } from "../contexts/theme-context";
import type { Part, PartList } from "../types";

interface MessageContentProps {
  content: PartList;
  taskUid: string;
  messageIndex: number;
  role: "user" | "assistant" | "system";
  editingPart: {
    taskUid: string;
    messageIndex: number;
    partIndex: number | null;
    isEditingNew?: boolean;
  } | null;
  editedContent: string;
  onEdit: (
    taskUid: string,
    messageIndex: number,
    partIndex: number | null,
    content: string,
    isEditingNew?: boolean,
  ) => void;
  onSave: () => void;
  onCancel: () => void;
  onRemovePart: (
    taskUid: string,
    messageIndex: number,
    partIndex: number,
  ) => void;
  onEditedContentChange: (content: string) => void;
  onPreview: (
    taskUid: string,
    messageIndex: number,
    partIndex: number,
    content: string,
  ) => void;
}

export const MessageContent = forwardRef<HTMLDivElement, MessageContentProps>(
  function MessageContent(
    {
      content,
      taskUid,
      messageIndex,
      role,
      editingPart,
      editedContent,
      onEdit,
      onSave,
      onCancel,
      onRemovePart,
      onEditedContentChange,
      onPreview,
    },
    ref,
  ) {
    const { theme } = useTheme();
    const [copiedFeedback, setCopiedFeedback] = useState<{
      [key: number]: boolean;
    }>({});
    const [showDiff, setShowDiff] = useState(false);
    const [isSmallScreen, setIsSmallScreen] = useState(
      typeof window !== "undefined" ? window.innerWidth < 1024 : false,
    );
    const isEditing =
      editingPart?.taskUid === taskUid &&
      editingPart?.messageIndex === messageIndex;

    useEffect(() => {
      if (typeof window === "undefined") return;
      const handleResize = () => {
        setIsSmallScreen(window.innerWidth < 1024);
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

    if (!Array.isArray(content)) {
      return (
        <div ref={ref} className="space-y-4">
          <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-foreground text-sm">
            {content}
          </pre>
        </div>
      );
    }

    const handleCopyPart = (part: Part, partIndex: number) => {
      const textContent = part.newText !== undefined ? part.newText : part.text;
      const jsonString = JSON.stringify(textContent || "");
      navigator.clipboard.writeText(jsonString);
      setCopiedFeedback((prev) => ({ ...prev, [partIndex]: true }));
      setTimeout(
        () => setCopiedFeedback((prev) => ({ ...prev, [partIndex]: false })),
        2000,
      );
    };

    return (
      <div ref={ref} className="space-y-4">
        {content.map((part, partIndex) => {
          const isEditingThis =
            isEditing && editingPart?.partIndex === partIndex;
          const partIsDeleted = part.isDeleted || false;
          const hasNewText = part.newText !== undefined;
          const displayText = hasNewText ? part.newText : part.text;

          return (
            <div
              key={partIndex}
              className={`rounded-md border p-3 ${
                partIsDeleted
                  ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                  : "bg-muted/50"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <strong className="font-semibold text-gray-600 text-sm uppercase">
                    {part.type}
                  </strong>
                  {partIsDeleted && (
                    <span className="inline-flex items-center rounded-md bg-red-600 px-2 py-1 font-medium text-white text-xs">
                      Deleted
                    </span>
                  )}
                  {hasNewText && !partIsDeleted && (
                    <span className="inline-flex items-center rounded-md bg-blue-600 px-2 py-1 font-medium text-white text-xs">
                      Modified
                    </span>
                  )}
                  {hasNewText && !partIsDeleted && (
                    <button
                      type="button"
                      onClick={() => setShowDiff(!showDiff)}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 font-medium text-xs transition-colors ${
                        showDiff
                          ? "bg-purple-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      <GitCompare className="h-3 w-3" />
                      {showDiff ? "Hide Diff" : "Show Diff"}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isEditingThis ? (
                    <>
                      <button
                        type="button"
                        onClick={onSave}
                        className="inline-flex items-center justify-center rounded-md bg-green-600 px-3 py-1.5 font-medium text-white text-xs shadow-sm transition-colors hover:bg-green-700 focus:outline-none"
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
                          onEdit(
                            taskUid,
                            messageIndex,
                            partIndex,
                            displayText || "",
                          )
                        }
                        className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs shadow-sm transition-colors hover:bg-primary/90 focus:outline-none"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onPreview(
                            taskUid,
                            messageIndex,
                            partIndex,
                            displayText || "",
                          )
                        }
                        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white text-xs shadow-sm transition-colors hover:bg-blue-700 focus:outline-none"
                      >
                        Formatted Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onRemovePart(taskUid, messageIndex, partIndex)
                        }
                        className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 font-medium text-xs shadow-sm transition-colors focus:outline-none ${
                          partIsDeleted
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : "bg-red-600 text-white hover:bg-red-700"
                        }`}
                      >
                        {partIsDeleted ? "Restore Part" : "Delete Part"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyPart(part, partIndex)}
                        className="rounded-md bg-gray-500 px-3 py-1 font-medium text-white text-xs shadow-sm transition-colors hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                      >
                        {copiedFeedback[partIndex] ? "Copied!" : "Copy Part"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isEditingThis ? (
                <TextareaAutosize
                  value={editedContent}
                  onChange={(e) => onEditedContentChange(e.target.value)}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  placeholder="Enter content..."
                  minRows={3}
                  maxRows={10}
                />
              ) : showDiff && part.newText && !partIsDeleted ? (
                <div className="rounded-md border border-border bg-background">
                  <div className="border-border border-b p-2 font-medium text-muted-foreground text-xs">
                    Changes:
                  </div>
                  <ReactDiffViewer
                    oldValue={part.text}
                    newValue={part.newText}
                    splitView={!isSmallScreen}
                    leftTitle="Before"
                    rightTitle="After"
                    showDiffOnly={true}
                    hideLineNumbers={isSmallScreen}
                    useDarkTheme={theme === "dark"}
                    styles={{
                      variables: {
                        light: {
                          codeFoldGutterBackground: "#f8f9fa",
                          codeFoldBackground: "#f1f8ff",
                          addedBackground: "#e6ffed",
                          addedColor: "#24292e",
                          removedBackground: "#ffeef0",
                          removedColor: "#24292e",
                          wordAddedBackground: "#acf2bd",
                          wordRemovedBackground: "#fdb8c0",
                          addedGutterBackground: "#cdffd8",
                          removedGutterBackground: "#fdbdbe",
                          gutterBackground: "#f8f9fa",
                          gutterBackgroundDark: "#f8f9fa",
                          highlightBackground: "#fffbdd",
                          highlightGutterBackground: "#fff5b4",
                          diffViewerBackground: "#ffffff",
                          diffViewerColor: "#24292e",
                        },
                        dark: {
                          codeFoldGutterBackground: "#2d3748",
                          codeFoldBackground: "#1a202c",
                          addedBackground: "#22543d",
                          addedColor: "#e2e8f0",
                          removedBackground: "#742a2a",
                          removedColor: "#e2e8f0",
                          wordAddedBackground: "#38a169",
                          wordRemovedBackground: "#e53e3e",
                          addedGutterBackground: "#276749",
                          removedGutterBackground: "#9b2c2c",
                          gutterBackground: "#2d3748",
                          gutterBackgroundDark: "#2d3748",
                          highlightBackground: "#744210",
                          highlightGutterBackground: "#975a16",
                          diffViewerBackground: "#1a202c",
                          diffViewerColor: "#e2e8f0",
                        },
                      },
                      contentText: {
                        fontSize: "14px",
                        lineHeight: "1.4",
                      },
                      diffContainer: {
                        maxHeight: "50vh",
                        overflow: "auto",
                      },
                    }}
                  />
                </div>
              ) : (
                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-foreground text-sm">
                  {(role === "assistant" || role === "user") && !isEditingThis
                    ? (() => {
                        if (!displayText) return null;
                        const parts = displayText.split(
                          /(<api-request .*?<\/api-request>|<(?:system-reminder|user-reminder)>[\s\S]*?<\/(?:system-reminder|user-reminder)>|<environment-details>[\s\S]*?<\/environment-details>)/gs,
                        );
                        let requestCounter = 0;
                        return parts.map((part, i) => {
                          const isApiRequest =
                            /(<api-request .*?<\/api-request>)/gs.test(part);
                          const isSystemReminder =
                            /(<(?:system-reminder|user-reminder)>[\s\S]*?<\/(?:system-reminder|user-reminder)>)/gs.test(
                              part,
                            );
                          const isEnvironmentDetails =
                            /(<environment-details>[\s\S]*?<\/environment-details>)/gs.test(
                              part,
                            );
                          if (
                            isApiRequest ||
                            isSystemReminder ||
                            isEnvironmentDetails
                          ) {
                            let id: string;
                            if (isApiRequest) {
                              id = `api-request-${messageIndex}-${partIndex}-${requestCounter++}`;
                            } else if (isSystemReminder) {
                              id = `system-reminder-${messageIndex}-${partIndex}-${requestCounter++}`;
                            } else {
                              id = `environment-details-${messageIndex}-${partIndex}-${requestCounter++}`;
                            }
                            return (
                              <span key={i} id={id}>
                                {part}
                              </span>
                            );
                          }
                          return part;
                        });
                      })()
                    : displayText}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    );
  },
);
