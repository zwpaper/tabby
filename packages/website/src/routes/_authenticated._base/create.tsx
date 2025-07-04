import { CreateTask } from "@/components/task/create-task";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const createSearchSchema = z.object({
  enableLocalCreation: z.boolean().optional(),
});

export const Route = createFileRoute("/_authenticated/_base/create")({
  component: RouteComponent,
  validateSearch: (search) => createSearchSchema.parse(search),
});

function RouteComponent() {
  const { enableLocalCreation } = Route.useSearch();
  return <CreateTask enableLocalCreation={enableLocalCreation} />;
}
