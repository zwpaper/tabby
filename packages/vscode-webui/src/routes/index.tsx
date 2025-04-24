import { authClient } from "@/lib/api";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  const { data: session, error, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="text-center">
        <header className="min-h-screen flex flex-col items-center justify-center bg-[#282c34] text-white text-[calc(10px+2vmin)]">
          <div className="h-[10vmin] w-[10vmin] border-4 border-t-[#61dafb] border-[#282c34] rounded-full animate-spin" />
        </header>
      </div>
    );
  }

  if (!session || error) {
    return (
      <div className="text-center">
        <header className="min-h-screen flex flex-col items-center justify-center bg-[#282c34] text-white text-[calc(10px+2vmin)]">
          <a
            className="text-[#61dafb] hover:underline"
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

  return (
    <div className="text-center">
      <header className="min-h-screen flex flex-col items-center justify-center bg-[#282c34] text-white text-[calc(10px+2vmin)]">
        <p>Welcome, {session.user.name}!</p>
      </header>
    </div>
  );
}
