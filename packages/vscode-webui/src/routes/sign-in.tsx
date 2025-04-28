import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sign-in")({
  component: SignInPage,
});

function SignInPage() {
  return (
    <div className="text-center">
      <header className="min-h-screen flex flex-col items-center justify-center bg-transparent text-[calc(10px+2vmin)]">
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
