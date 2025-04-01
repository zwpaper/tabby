import type React from "react";
import { createContext, useContext } from "react";

// Define the shape of the application configuration
export interface AppConfig {
  dev: boolean;
}

// Create the context with a default value (can be null or a default config object)
const AppConfigContext = createContext<AppConfig | null>(null);

// Define the props for the provider component
interface AppConfigProviderProps {
  children: React.ReactNode;
  config: AppConfig;
}

// Create the provider component
export const AppConfigProvider: React.FC<AppConfigProviderProps> = ({
  children,
  config,
}) => {
  return (
    <AppConfigContext.Provider value={config}>
      {children}
    </AppConfigContext.Provider>
  );
};

// Create the custom hook to use the AppConfig context
export const useAppConfig = (): AppConfig => {
  const context = useContext(AppConfigContext);
  if (context === null) {
    throw new Error("useAppConfig must be used within an AppConfigProvider");
  }
  return context;
};
