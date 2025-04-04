import { LoginForm } from "@/components/login-form";
import { authClient } from "@/lib/auth-client";
import { createFileRoute, redirect, useSearch } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  loader: async () => {
    const { data: session } = await authClient.getSession();
    if (session) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { callbackURL, deviceName } = useSearch({
    from: "/login",
    select: (search: { callbackURL?: string; deviceName?: string }) => {
      return {
        callbackURL: search.callbackURL as string,
        deviceName: search.deviceName as string,
      };
    },
  });
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <LoginForm callbackURL={callbackURL} deviceName={deviceName} />
      </div>
    </div>
  );
}
