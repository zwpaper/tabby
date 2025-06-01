import { SettingsPage } from "@/features/settings";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/settings")({
  component: () => {
    const { auth: authData } = Route.useRouteContext();
    return <SettingsPage user={authData.user} />;
  },
});
