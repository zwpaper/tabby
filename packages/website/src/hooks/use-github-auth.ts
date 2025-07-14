import { authClient } from "@/lib/auth-client";
import { useCallback } from "react";

export function useGithubAuth() {
  const connectGithub = useCallback(() => {
    authClient.signIn.social({
      provider: "github",
      scopes: [
        "gist",
        "read:org",
        "read:user",
        "repo",
        "user:email",
        "workflow",
      ],
      callbackURL: "/profile?github_connected=true",
    });
  }, []);

  return {
    connectGithub,
  };
}
