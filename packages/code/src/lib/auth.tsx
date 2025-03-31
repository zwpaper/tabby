import { db } from "@/lib/db";
import type { User } from "@instantdb/react";
import type React from "react";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error?: { message: string };
  sendMagicCode: (email: string) => Promise<void>;
  loginWithMagicCode: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { isLoading, user, error } = db.useAuth();

  const loginWithMagicCode = async (email: string, code: string) => {
    const resp = await db.auth
      .signInWithMagicCode({ email, code })
      .catch((err) => new Error(err.body?.message));
    if (resp instanceof Error) {
      throw resp;
    }
  };

  const sendMagicCode = async (email: string) => {
    await db.auth.sendMagicCode({ email });
  };

  const logout = async () => {
    await db.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
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
