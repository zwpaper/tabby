import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Theme = "dark" | "light";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);
const storageKey = "pochi-ui-theme";

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeImpl] = useState<Theme>("dark");

  const setTheme = useCallback((theme: Theme) => {
    localStorage.setItem(storageKey, theme);
    setThemeImpl(theme);
  }, []);

  useEffect(() => {
    const root = window.document.body;
    root.classList.remove("light", "dark", "vscode-dark", "vscode-light");
    root.classList.add(theme, `vscode-${theme}`);
  }, [theme]);

  useEffect(() => {
    const body = window.document.body;

    const updateTheme = () => {
      if (body.classList.contains("vscode-light")) {
        setTheme("light");
      } else if (body.classList.contains("vscode-dark")) {
        setTheme("dark");
      }
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [setTheme]);

  const value = {
    theme,
    setTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
