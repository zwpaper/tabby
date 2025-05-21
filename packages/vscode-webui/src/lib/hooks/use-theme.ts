import { useEffect, useState } from "react";

export type ThemeType = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeType>("dark");

  useEffect(() => {
    const body = window.document.body;

    const updateTheme = () => {
      setTheme(body.classList.contains("vscode-light") ? "light" : "dark");
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}
