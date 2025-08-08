import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { useTaskView } from "../contexts/task-view-context";
import { useRounds } from "../hooks/use-rounds";
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
  onRevertPart: (
    taskUid: string,
    messageIndex: number,
    partIndex: number,
  ) => void;
  onEditedContentChange: (content: string) => void;
}

export interface TaskViewHandle {
  scrollToTop: () => void;
  scrollToBottom: () => void;
}

export const TaskView = forwardRef<TaskViewHandle, TaskViewProps>(
  (
    {
      selectedTask,
      editingPart,
      editedContent,
      onEdit,
      onSave,
      onCancel,
      onToggleDeleteMessage,
      onRemovePart,
      onRevertPart,
      onEditedContentChange,
    },
    ref,
  ) => {
    const { showSystemMessages } = useTaskView();
    const { messagesWithRounds, getRoundTitle } = useRounds(
      selectedTask.messages,
    );
    const [copiedMessageFeedback, setCopiedMessageFeedback] = useState<{
      [key: number]: boolean;
    }>({});

    const taskViewRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

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

    useImperativeHandle(ref, () => ({
      scrollToTop,
      scrollToBottom,
    }));

    const filteredMessages = selectedTask.messages.filter(
      (message: Message) => {
        if (message.role === "system" && !showSystemMessages) {
          return false;
        }
        return true;
      },
    );

    const handleCopyMessage = (message: Message, messageIndex: number) => {
      const textContent = message.content
        .filter((part) => !part.isDeleted)
        .map((part) => (part.newText !== undefined ? part.newText : part.text))
        .filter((text) => text)
        .join("\n\n");

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
      <div className="flex gap-4">
        <div ref={taskViewRef} className="min-w-0 flex-1 space-y-6">
          <div ref={messagesContainerRef} className="space-y-6">
            {filteredMessages.map((message) => {
              const originalIndex = selectedTask.messages.indexOf(message);
              const messageWithRound = messagesWithRounds[originalIndex];
              const hasDeletedParts =
                Array.isArray(message.content) &&
                message.content.some((part) => part.isDeleted);

              return (
                <div key={originalIndex}>
                  {/* Round marker */}
                  {messageWithRound?.isRoundStart && (
                    <div className="mb-2">
                      <span className="inline-block rounded-full bg-primary/10 px-3 py-1 font-medium text-primary text-sm">
                        {getRoundTitle(originalIndex)}
                      </span>
                    </div>
                  )}

                  <div
                    id={`message-${originalIndex}`}
                    className="rounded-lg border bg-card p-4 shadow-sm"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <strong className="font-semibold text-foreground text-md capitalize">
                        {message.role}
                      </strong>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleDeleteMessage(
                              selectedTask.uid,
                              originalIndex,
                            )
                          }
                          className={`inline-flex items-center justify-center rounded-md border px-3 py-1.5 font-medium text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                            hasDeletedParts
                              ? "border-green-600 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-500 dark:bg-green-950 dark:text-green-400 dark:hover:bg-green-900"
                              : "border-destructive/50 bg-background text-destructive hover:bg-destructive/10"
                          }`}
                        >
                          {hasDeletedParts
                            ? "Restore Message"
                            : "Delete Message"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyMessage(message, originalIndex)
                          }
                          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 font-medium text-foreground text-xs transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        >
                          {copiedMessageFeedback[originalIndex]
                            ? "Copied!"
                            : "Copy Message"}
                        </button>
                      </div>
                    </div>
                    <MessageContent
                      ref={
                        message.role === "assistant" ? contentRef : undefined
                      }
                      content={message.content}
                      taskUid={selectedTask.uid}
                      messageIndex={originalIndex}
                      role={message.role}
                      editingPart={editingPart}
                      editedContent={editedContent}
                      onEdit={onEdit}
                      onSave={onSave}
                      onCancel={onCancel}
                      onRemovePart={onRemovePart}
                      onRevertPart={onRevertPart}
                      onEditedContentChange={onEditedContentChange}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  },
);
