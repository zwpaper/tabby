import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { LogInIcon, TerminalIcon } from "lucide-react";

export const Route = createFileRoute("/sign-in")({
  component: SignInPage,
});

function SignInPage() {
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
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "!text-foreground mb-4",
        )}
        href="command:ragdoll.openLoginPage"
        target="_blank"
        rel="noopener noreferrer"
      >
        <LogInIcon className="mr-2 size-4" /> Sign In
      </a>
    </div>
  );
}
