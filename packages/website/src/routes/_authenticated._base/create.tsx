import { CreateTask } from "@/components/task/create-task";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_base/create")({
  component: RouteComponent,
});

function RouteComponent() {
  return <CreateTask />;
}
