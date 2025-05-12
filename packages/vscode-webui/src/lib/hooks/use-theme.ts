import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

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
