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
  error: { message: string } | null;
  sendMagicCode: (email: string) => Promise<void>;
  loginWithMagicCode: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { data, isLoading, error, sendMagicCode, loginWithMagicCode, logout } =
    useAuthApi();

  return (
    <AuthContext.Provider
      value={{
        data,
        isLoading,
        sendMagicCode,
        loginWithMagicCode,
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
