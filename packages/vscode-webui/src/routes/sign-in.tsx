import { authHooks } from "@/lib/auth-client";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/sign-in")({
  component: SignInPage,
});

function SignInPage() {
  const { navigate } = useRouter();
  const { session } = authHooks.useSession();
  useEffect(() => {
    if (session) {
      navigate({ to: "/", replace: true });
    }
  }, [session, navigate]);
  return (
    <div className="text-center">
      <header className="flex min-h-screen flex-col items-center justify-center bg-transparent text-[calc(10px+2vmin)]">
        <a
          className="text-primary hover:underline"
          href="command:ragdoll.openLoginPage"
          target="_blank"
          rel="noopener noreferrer"
        >
          Login
        </a>
      </header>
    </div>
  );
}
