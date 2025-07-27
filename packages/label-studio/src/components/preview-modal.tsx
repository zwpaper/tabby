import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useEffect, useState } from "react";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onSave: (newContent: string) => void;
  language: "text" | "custom";
}

export function PreviewModal({
  isOpen,
  onClose,
  content,
  onSave,
  language,
}: PreviewModalProps) {
  const [editedContent, setEditedContent] = useState(content);

  useEffect(() => {
    setEditedContent(content);
  }, [content]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    onSave(editedContent);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-3/4 w-3/4 flex-col rounded-lg bg-background shadow-lg">
        <div className="border-b p-4">
          <h2 className="font-semibold text-lg">Preview & Edit</h2>
        </div>
        <div className="flex-grow overflow-y-auto p-4">
          {language === "custom" ? (
            <CodeMirror
              value={editedContent}
              onChange={(value) => setEditedContent(value)}
              extensions={[json(), EditorView.lineWrapping]}
              className="h-full"
            />
          ) : (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="h-full w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          )}
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border bg-background px-4 py-2 hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
