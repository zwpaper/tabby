import { type ReactNode, createContext, useContext, useEffect } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: Theme;
}

export function ThemeProvider({
  children,
  initialTheme = "light",
}: ThemeProviderProps) {
  // Apply theme to document root on mount
  useEffect(() => {
    const documentRoot = document.documentElement;
    documentRoot.classList.remove("light", "dark");
    documentRoot.classList.add(initialTheme);
  }, [initialTheme]);

  return (
    <ThemeContext.Provider value={{ theme: initialTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
