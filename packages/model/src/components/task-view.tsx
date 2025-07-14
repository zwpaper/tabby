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
        <h3 className="font-bold text-gray-900 text-xl">
          <a
            href={`https://app.getpochi.com/share/${selectedTask.uid}`}
            target="_blank"
            rel="noreferrer"
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
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label
            htmlFor="verified-checkbox"
            className="ml-2 block text-gray-900 text-sm"
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
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label
            htmlFor="excluded-checkbox"
            className="ml-2 block text-gray-900 text-sm"
          >
            Excluded
          </label>
        </div>
      </div>
      <div className="space-y-6">
        {selectedTask.messages.map((message: Message, index: number) => (
          <div
            key={index}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <strong className="font-semibold text-gray-700 text-md capitalize">
                {message.role}
              </strong>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onRemoveMessage(selectedTask.uid, index)}
                  className="rounded-md bg-red-500 px-3 py-1 font-medium text-white text-xs shadow-sm transition-colors hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
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
