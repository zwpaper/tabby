import { CreateTask } from "@/components/task/create-task";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const createSearchSchema = z.object({
  remote: z.boolean().optional(),
});

export const Route = createFileRoute("/_authenticated/_base/create")({
  component: RouteComponent,
  validateSearch: (search) => createSearchSchema.parse(search),
});

function RouteComponent() {
  const { remote } = Route.useSearch();
  return <CreateTask initialRemote={remote} />;
}
