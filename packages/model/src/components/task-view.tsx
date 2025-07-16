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
  onRemoveMessage: (taskUid: string, messageIndex: number) => void;
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
  onRemoveMessage,
  onRemovePart,
  onEditedContentChange,
  onVerifiedChange,
  onExcludedChange,
}: TaskViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
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
      </div>
      <div className="space-y-6">
        {selectedTask.messages.map((message: Message, index: number) => (
          <div key={index} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <strong className="font-semibold text-foreground text-md capitalize">
                {message.role}
              </strong>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onRemoveMessage(selectedTask.uid, index)}
                  className="inline-flex items-center justify-center rounded-md border bg-background px-3 py-1.5 font-medium text-foreground text-xs shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
                >
                  Remove Message
                </button>
              </div>
            </div>
            <MessageContent
              role={message.role}
              content={message.content}
              taskUid={selectedTask.uid}
              messageIndex={index}
              editingPart={editingPart}
              editedContent={editedContent}
              onEdit={onEdit}
              onSave={onSave}
              onCancel={onCancel}
              onRemovePart={onRemovePart}
              onEditedContentChange={onEditedContentChange}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
