import { isVSCodeEnvironment } from "@/lib/vscode";
import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

// Global constants for theme-related class names and configuration
const ThemeConstants = {
  Themes: {
    Light: "light" as const,
    Dark: "dark" as const,
  },
  VSCodeClasses: {
    Light: "vscode-light",
    Dark: "vscode-dark",
  },
  MutationObserverConfig: {
    attributes: true,
    attributeFilter: ["class"] as string[],
  },
} as const;

const initialState: ThemeProviderState = {
  theme: ThemeConstants.Themes.Dark,
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
      if (body.classList.contains(ThemeConstants.VSCodeClasses.Light)) {
        setTheme(ThemeConstants.Themes.Light);
      } else if (body.classList.contains(ThemeConstants.VSCodeClasses.Dark)) {
        setTheme(ThemeConstants.Themes.Dark);
      }
    };

    // Set initial theme
    updateThemeFromVSCode();

    // Observe changes to VSCode theme classes
    const observer = new MutationObserver(updateThemeFromVSCode);
    observer.observe(body, ThemeConstants.MutationObserverConfig);

    return () => observer.disconnect();
  }, [setTheme]);
}

/**
 * Custom hook for managing non-VSCode theme detection
 * Observes document root class changes and updates theme accordingly
 */
function useStandaloneThemeDetection(setTheme: (theme: Theme) => void) {
  useEffect(() => {
    if (isVSCodeEnvironment()) return;

    const root = window.document.documentElement;

    const updateThemeFromRoot = () => {
      if (root.classList.contains(ThemeConstants.Themes.Light)) {
        setTheme(ThemeConstants.Themes.Light);
      } else if (root.classList.contains(ThemeConstants.Themes.Dark)) {
        setTheme(ThemeConstants.Themes.Dark);
      }
    };

    // Set initial theme
    updateThemeFromRoot();

    // Observe changes to theme classes
    const observer = new MutationObserver(updateThemeFromRoot);
    observer.observe(root, ThemeConstants.MutationObserverConfig);

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
    root.classList.remove(
      ThemeConstants.Themes.Light,
      ThemeConstants.Themes.Dark,
    );
    root.classList.add(theme);
  }, [theme]);

  // Apply VSCode theme classes to body in non-VSCode environment
  useEffect(() => {
    if (isVSCodeEnvironment()) return;

    const body = document.body;
    const { Light, Dark } = ThemeConstants.VSCodeClasses;

    // Remove existing VSCode theme classes
    body.classList.remove(Light, Dark);

    // Add appropriate VSCode theme class
    const vscodeClass = theme === ThemeConstants.Themes.Light ? Light : Dark;
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
  defaultTheme = ThemeConstants.Themes.Dark,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  // Apply theme classes to document elements
  useThemeApplication(theme);

  // Set up theme detection based on environment
  useVSCodeThemeDetection(setTheme);
  useStandaloneThemeDetection(setTheme);

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
