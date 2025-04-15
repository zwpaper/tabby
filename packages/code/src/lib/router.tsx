import type React from "react";
import { createContext, useContext, useState } from "react";

type RouterContextType = {
  path: string;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  back: () => void;
};

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState<string>("/chat");
  const [history, setHistory] = useState<string[]>(["/chat"]);

  const navigate = (newPath: string, options?: { replace?: boolean }) => {
    setPath(newPath);

    if (options?.replace) {
      // Replace the current path in history instead of adding a new one
      setHistory((prevHistory) => {
        if (prevHistory.length === 0) {
          return [newPath];
        }
        const newHistory = [...prevHistory];
        newHistory[newHistory.length - 1] = newPath;
        return newHistory;
      });
    } else {
      // Add the new path to history (default behavior)
      setHistory((prevHistory) => [...prevHistory, newPath]);
    }
  };

  const back = () => {
    if (history.length > 1) {
      // Remove current path and get the previous one
      const newHistory = [...history];
      newHistory.pop();
      const previousPath = newHistory[newHistory.length - 1];

      setPath(previousPath);
      setHistory(newHistory);
    }
  };

  return (
    <RouterContext.Provider value={{ path, navigate, back }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error("useRouter must be used within a RouterProvider");
  }
  return context;
}
