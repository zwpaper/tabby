import { Home } from "@/components/home/home";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_base/tasks/create")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Home titleVisible={false} />;
}
