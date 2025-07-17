import { ChevronDown, ChevronUp } from "lucide-react";
import { useRef, useState } from "react";
import type { Message, TaskData } from "../types";
import { MessageContent } from "./message-content";

interface TaskViewProps {
  selectedTask: TaskData;
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
  onToggleDeleteMessage: (taskUid: string, messageIndex: number) => void;
  onRemovePart: (
    taskUid: string,
    messageIndex: number,
    partIndex: number,
  ) => void;
  onEditedContentChange: (content: string) => void;
  onVerifiedChange: (taskUid: string, verified: boolean) => void;
  onExcludedChange: (taskUid: string, excluded: boolean) => void;
}

export function TaskView({
  selectedTask,
  editingPart,
  editedContent,
  onEdit,
  onSave,
  onCancel,
  onToggleDeleteMessage,
  onRemovePart,
  onEditedContentChange,
  onVerifiedChange,
  onExcludedChange,
}: TaskViewProps) {
  const [showSystemMessages, setShowSystemMessages] = useState(false);
  const [copiedMessageFeedback, setCopiedMessageFeedback] = useState<{
    [key: number]: boolean;
  }>({});

  const taskViewRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    if (taskViewRef.current) {
      taskViewRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const lastMessage = messagesContainerRef.current.lastElementChild;
      if (lastMessage) {
        lastMessage.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }
  };

  // Filter messages based on showSystemMessages state
  const filteredMessages = selectedTask.messages.filter((message: Message) => {
    if (message.role === "system" && !showSystemMessages) {
      return false;
    }
    return true;
  });

  const handleCopyMessage = (message: Message, messageIndex: number) => {
    // Copy the text content as a JSON string (with quotes and escapes)
    const textContent = message.content
      .filter((part) => !part.isDeleted) // Skip deleted parts
      .map((part) => (part.newText !== undefined ? part.newText : part.text))
      .filter((text) => text) // Filter out empty strings
      .join("\n\n"); // Join with double newline for readability

    const jsonString = JSON.stringify(textContent);
    navigator.clipboard.writeText(jsonString);
    setCopiedMessageFeedback((prev) => ({ ...prev, [messageIndex]: true }));
    setTimeout(
      () =>
        setCopiedMessageFeedback((prev) => ({
          ...prev,
          [messageIndex]: false,
        })),
      2000,
    );
  };

  return (
    <div ref={taskViewRef} className="space-y-6">
      {/* Floating header with task controls - positioned within TaskView */}
      <div className="sticky top-4 z-10 mb-6 transform rounded-lg border border-gray-200 bg-white/90 p-4 shadow-lg backdrop-blur-md backdrop-saturate-150 transition-all duration-300 hover:shadow-xl hover:backdrop-blur-lg dark:border-gray-700 dark:bg-gray-800/90">
        <div className="flex flex-wrap items-center gap-4">
          <h3 className="font-bold text-foreground text-xl">
            <a
              href={`https://app.getpochi.com/share/${selectedTask.uid}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary transition-colors hover:text-primary/80"
            >
              {selectedTask.uid}
            </a>
          </h3>
          <div className="flex items-center">
            <input
              id="verified-checkbox"
              type="checkbox"
              checked={selectedTask.verified}
              onChange={(e) =>
                onVerifiedChange(selectedTask.uid, e.target.checked)
              }
              className="h-4 w-4 rounded border-input text-primary"
            />
            <label
              htmlFor="verified-checkbox"
              className="ml-2 block text-foreground text-sm"
            >
              Verified
            </label>
          </div>
          <div className="flex items-center">
            <input
              id="excluded-checkbox"
              type="checkbox"
              checked={selectedTask.excluded}
              onChange={(e) =>
                onExcludedChange(selectedTask.uid, e.target.checked)
              }
              className="h-4 w-4 rounded border-input text-primary"
            />
            <label
              htmlFor="excluded-checkbox"
              className="ml-2 block text-foreground text-sm"
            >
              Excluded
            </label>
          </div>
          <div className="flex items-center">
            <input
              id="show-system-checkbox"
              type="checkbox"
              checked={showSystemMessages}
              onChange={(e) => setShowSystemMessages(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary"
            />
            <label
              htmlFor="show-system-checkbox"
              className="ml-2 block text-foreground text-sm"
            >
              Show System Messages
            </label>
          </div>

          {/* Navigation buttons */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={scrollToTop}
              className="flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              title="Go to top"
            >
              <ChevronUp className="h-4 w-4" />
              <span className="text-sm">Top</span>
            </button>
            <button
              type="button"
              onClick={scrollToBottom}
              className="flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              title="Go to bottom"
            >
              <ChevronDown className="h-4 w-4" />
              <span className="text-sm">Bottom</span>
            </button>
          </div>
        </div>
      </div>
      <div ref={messagesContainerRef} className="space-y-6">
        {filteredMessages.map((message: Message) => {
          // Find the original index in the full messages array
          const originalIndex = selectedTask.messages.indexOf(message);
          // Check if any parts in this message are deleted
          const hasDeletedParts =
            Array.isArray(message.content) &&
            message.content.some((part) => part.isDeleted);

          return (
            <div
              key={originalIndex}
              className="rounded-lg border bg-card p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <strong className="font-semibold text-foreground text-md capitalize">
                  {message.role}
                </strong>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyMessage(message, originalIndex)}
                    className="inline-flex items-center justify-center rounded-md bg-gray-500 px-3 py-1.5 font-medium text-white text-xs shadow-sm transition-colors hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    {copiedMessageFeedback[originalIndex]
                      ? "Copied!"
                      : "Copy Message"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onToggleDeleteMessage(selectedTask.uid, originalIndex)
                    }
                    className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 font-medium text-white text-xs shadow-sm transition-colors focus:outline-none ${
                      hasDeletedParts
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    {hasDeletedParts ? "Restore Message" : "Delete Message"}
                  </button>
                </div>
              </div>
              <MessageContent
                content={message.content}
                taskUid={selectedTask.uid}
                messageIndex={originalIndex}
                editingPart={editingPart}
                editedContent={editedContent}
                onEdit={onEdit}
                onSave={onSave}
                onCancel={onCancel}
                onRemovePart={onRemovePart}
                onEditedContentChange={onEditedContentChange}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
