import { AuthCard } from "@daveyplate/better-auth-ui";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/$pathname")({
  component: Auth,
});

function Auth() {
  const { pathname } = Route.useParams();
  return (
    <div className="flex flex-col grow size-full min-h-screen items-center justify-center gap-3">
      <AuthCard
        socialLayout="vertical"
        pathname={pathname}
        classNames={{
          base: "gap-0",
          content: "[&>form]:gap-4 [&>form>div:nth-child(2)]:hidden",
        }}
      />
    </div>
  );
}
