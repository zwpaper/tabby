import type React from "react";
import {
  type MutableRefObject,
  createContext,
  useContext,
  useRef,
  useState,
} from "react";
import { useAppConfig } from "./app-config";

type Path =
  | {
      route: "/chat";
      params: {
        id: string;
      };
    }
  | {
      route: "/listen";
      params: {
        listen: string;
      };
    }
  | "/tasks"
  | "/settings";

type RouterContextType = {
  path: Path;
  navigate: (path: Path, options?: { replace?: boolean }) => void;
  back: () => void;
  initialPromptSent: MutableRefObject<boolean>;
};

const RouterContext = createContext<RouterContextType | undefined>(undefined);

// const defaultRoute = "/chat";

export function RouterProvider({ children }: { children: React.ReactNode }) {
  let defaultRoute: Path = "/tasks";
  const appConfig = useAppConfig();
  if (appConfig.listen) {
    defaultRoute = {
      route: "/listen",
      params: {
        listen: appConfig.listen,
      },
    };
  }
  const [path, setPath] = useState<Path>(defaultRoute);
  const [history, setHistory] = useState<Path[]>([defaultRoute]);
  const initialPromptSent = useRef<boolean>(false);

  const navigate = (newPath: Path, options?: { replace?: boolean }) => {
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
    <RouterContext.Provider
      value={{
        path,
        navigate,
        back,
        initialPromptSent,
      }}
    >
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
