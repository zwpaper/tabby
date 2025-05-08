import { buttonVariants } from "@/components/ui/button";
import { authHooks } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { LogInIcon, TerminalIcon } from "lucide-react";
import { useEffect } from "react";
import { z } from "zod";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search) => searchSchema.parse(search),
  component: SignInPage,
});

function SignInPage() {
  const { navigate } = useRouter();
  const { redirect } = Route.useSearch();
  const { session } = authHooks.useSession();

  useEffect(() => {
    if (session) {
      const redirectPath = redirect || "/";
      navigate({ to: redirectPath, replace: true });
    }
  }, [session, navigate, redirect]);

  return (
    <div className="flex h-screen select-none flex-col items-center justify-center p-5 text-center text-gray-300">
      <h2 className="mb-2 flex items-center gap-3 font-semibold text-2xl text-gray-100">
        <TerminalIcon className="animate-[spin_6s_linear_infinite]" />
        Welcome to Pochi
      </h2>
      <p className="mb-4 leading-relaxed">
        To use Pochi, you need to sign in with your account.
        <br />
        This allows Pochi to securely access your information and provide
        personalized assistance.
      </p>
      <a
        className={cn(buttonVariants({ variant: "ghost" }), "mb-4")}
        href="command:ragdoll.openLoginPage"
        target="_blank"
        rel="noopener noreferrer"
      >
        <LogInIcon className="mr-2 size-4" /> Sign In
      </a>
    </div>
  );
}
