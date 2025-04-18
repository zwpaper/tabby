import type { Session, User } from "better-auth";
import type React from "react";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useAuthApi } from "./api";

interface AuthContextType {
  data: {
    user: User;
    session: Session;
  } | null;
  isLoading: boolean;
  authClient: ReturnType<typeof useAuthApi>["authClient"];
  renewSession: (
    session: ReturnType<typeof useAuthApi>["authClient"]["$Infer"]["Session"],
  ) => void;
  error: { message: string } | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { data, isLoading, error, renewSession, authClient, logout } =
    useAuthApi();

  return (
    <AuthContext.Provider
      value={{
        data,
        isLoading,
        renewSession,
        authClient,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
