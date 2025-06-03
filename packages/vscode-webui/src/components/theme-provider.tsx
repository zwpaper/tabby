import { isVSCodeEnvironment } from "@/lib/vscode";
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

/**
 * Custom hook for managing VSCode theme detection
 * Observes VSCode environment body class changes and updates theme accordingly
 */
function useVSCodeThemeDetection(setTheme: (theme: Theme) => void) {
  useEffect(() => {
    if (!isVSCodeEnvironment()) return;

    const body = window.document.body;

    const updateThemeFromVSCode = () => {
      if (body.classList.contains("vscode-light")) {
        setTheme("light");
      } else if (body.classList.contains("vscode-dark")) {
        setTheme("dark");
      }
    };

    // Set initial theme
    updateThemeFromVSCode();

    // Observe changes to VSCode theme classes
    const observer = new MutationObserver(updateThemeFromVSCode);
    observer.observe(body, {
      attributes: true,
      attributeFilter: ["class"] as string[],
    });

    return () => observer.disconnect();
  }, [setTheme]);
}

/**
 * Custom hook for applying theme classes to document elements
 * Handles both root element and body element styling
 */
function useThemeApplication(theme: Theme) {
  // Apply theme class to document root
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  // Apply VSCode theme classes to body in non-VSCode environment
  useEffect(() => {
    if (isVSCodeEnvironment()) return;

    const body = document.body;

    // Remove existing VSCode theme classes
    body.classList.remove("vscode-light", "vscode-dark");

    // Add appropriate VSCode theme class
    const vscodeClass = theme === "light" ? "vscode-light" : "vscode-dark";
    body.classList.add(vscodeClass);
  }, [theme]);
}

/**
 * ThemeProvider component that manages theme state and provides theme context
 *
 * Features:
 * - Automatic theme detection in VSCode environment
 * - Manual theme control in standalone environment
 * - Proper cleanup of event listeners and observers
 * - Consistent theme application across document elements
 */
export function ThemeProvider({
  children,
  defaultTheme = "dark",
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeImpl] = useState<Theme>(defaultTheme);
  const setTheme = useCallback((theme: Theme) => {
    // debugger;
    setThemeImpl(theme);
  }, []);

  // Apply theme classes to document elements
  useThemeApplication(theme);

  // Set up theme detection based on environment
  useVSCodeThemeDetection(setTheme);
  // useStandaloneThemeDetection(setTheme);

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

/**
 * Hook to access theme context
 * Must be used within a ThemeProvider
 */
export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};
