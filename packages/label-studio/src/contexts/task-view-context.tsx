import { type ReactNode, createContext, useContext, useState } from "react";

interface TaskViewContextType {
  showSystemMessages: boolean;
  setShowSystemMessages: (show: boolean) => void;
  showOnlyEditedMessages: boolean;
  setShowOnlyEditedMessages: (show: boolean) => void;
}

const TaskViewContext = createContext<TaskViewContextType | undefined>(
  undefined,
);

export function TaskViewProvider({ children }: { children: ReactNode }) {
  const [showSystemMessages, setShowSystemMessages] = useState(false);
  const [showOnlyEditedMessages, setShowOnlyEditedMessages] = useState(false);

  return (
    <TaskViewContext.Provider
      value={{
        showSystemMessages,
        setShowSystemMessages,
        showOnlyEditedMessages,
        setShowOnlyEditedMessages,
      }}
    >
      {children}
    </TaskViewContext.Provider>
  );
}

export function useTaskView() {
  const context = useContext(TaskViewContext);
  if (context === undefined) {
    throw new Error("useTaskView must be used within a TaskViewProvider");
  }
  return context;
}
