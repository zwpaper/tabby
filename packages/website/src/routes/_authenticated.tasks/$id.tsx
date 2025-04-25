import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/tasks/$id")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/_authenticated/tasks/$id"!</div>;
}
