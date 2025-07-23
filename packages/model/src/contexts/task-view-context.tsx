import { type ReactNode, createContext, useContext, useState } from "react";

interface TaskViewContextType {
  showSystemMessages: boolean;
  setShowSystemMessages: (show: boolean) => void;
}

const TaskViewContext = createContext<TaskViewContextType | undefined>(
  undefined,
);

export function TaskViewProvider({ children }: { children: ReactNode }) {
  const [showSystemMessages, setShowSystemMessages] = useState(false);

  return (
    <TaskViewContext.Provider
      value={{ showSystemMessages, setShowSystemMessages }}
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
