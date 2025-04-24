import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  component: App,
});

function App() {
  const { auth } = Route.useRouteContext();

  return (
    <div className="text-center">
      <header className="min-h-screen flex flex-col items-center justify-center bg-[#282c34] text-white text-[calc(10px+2vmin)]">
        <p>Welcome, {auth.user.name}!</p>
      </header>
    </div>
  );
}
