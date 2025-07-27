import {
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { useTaskView } from "../contexts/task-view-context";
import type { TaskData } from "../types";

interface TaskBarProps {
  selectedTask: TaskData;
  onVerifiedChange: (taskUid: string, verified: boolean) => void;
  onExcludedChange: (taskUid: string, excluded: boolean) => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isTocOpen: boolean;
  toggleToc: () => void;
}

export function TaskBar({
  selectedTask,
  onVerifiedChange,
  onExcludedChange,
  scrollToTop,
  scrollToBottom,
  isSidebarOpen,
  toggleSidebar,
  isTocOpen,
  toggleToc,
}: TaskBarProps) {
  const { showSystemMessages, setShowSystemMessages } = useTaskView();

  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={toggleSidebar}
        className="flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
      >
        {isSidebarOpen ? (
          <PanelLeftClose className="h-4 w-4" />
        ) : (
          <PanelLeftOpen className="h-4 w-4" />
        )}
      </button>
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
          onChange={(e) => onVerifiedChange(selectedTask.uid, e.target.checked)}
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
          onChange={(e) => onExcludedChange(selectedTask.uid, e.target.checked)}
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
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleToc}
          className="flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-primary transition-colors hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          title={isTocOpen ? "Collapse TOC" : "Expand TOC"}
        >
          {isTocOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )}
        </button>
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
  );
}
