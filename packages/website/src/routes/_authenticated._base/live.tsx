import { LivePage } from "@/components/live/page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_base/live")({
  component: RouteComponent,
});

function RouteComponent() {
  return <LivePage />;
}
