import { useEffect, useState } from "react";
import { vscodeHost } from "../vscode";

export const useIsDevMode = () => {
  const [isDevMode, setIsDevMode] = useState(false);

  useEffect(() => {
    const fetchIsDevMode = async () => {
      try {
        const val = await vscodeHost.readIsDevMode();
        setIsDevMode(val);
      } catch (error) {
        console.error("Failed to fetch isDevMode:", error);
        setIsDevMode(false);
      }
    };
    fetchIsDevMode();
    const interval = setInterval(fetchIsDevMode, 3000);
    return () => clearInterval(interval);
  }, []);

  return isDevMode;
};
