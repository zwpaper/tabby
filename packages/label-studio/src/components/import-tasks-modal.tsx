import { X } from "lucide-react";
import { useEffect, useState } from "react";

const UsernameStorageKey = "storage-key-import-tasks-username";
const PasswordStorageKey = "storage-key-import-tasks-password";

interface ImportTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: ({ content, auth }: { content: string; auth: string }) => void;
}

export function ImportTasksModal({
  isOpen,
  onClose,
  onImport,
}: ImportTasksModalProps) {
  const [content, setContent] = useState("");
  const [username, setUsername] = useState(
    () => localStorage.getItem(UsernameStorageKey) || "",
  );
  const [password, setPassword] = useState(
    () => localStorage.getItem(PasswordStorageKey) || "",
  );

  useEffect(() => {
    localStorage.setItem(UsernameStorageKey, username);
  }, [username]);

  useEffect(() => {
    localStorage.setItem(PasswordStorageKey, password);
  }, [password]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onImport({ content, auth: `Basic ${btoa(`${username}:${password}`)}` });
      setContent("");
      onClose();
    }
  };

  const handleClose = () => {
    setContent("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-2xl rounded-lg bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-lg">
            Import Tasks
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="tasks-list"
              className="mb-2 block font-medium text-foreground text-sm"
            >
              Paste the list of tasks here. Each line should contain a task uid
              or a task url.
            </label>
            <textarea
              id="tasks-list"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your tasks here..."
              className="h-48 w-full resize-none rounded-md border bg-background px-3 py-2 text-foreground text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label
                htmlFor="username"
                className="mb-2 block font-medium text-foreground text-sm"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ragdoll"
                className="w-full rounded-md border bg-background px-3 py-2 text-foreground text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex-1">
              <label
                htmlFor="password"
                className="mb-2 block font-medium text-foreground text-sm"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-md border bg-background px-3 py-2 text-foreground text-sm placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 font-medium text-foreground text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim()}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm shadow-sm transition-colors hover:bg-primary/90 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              Import
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
