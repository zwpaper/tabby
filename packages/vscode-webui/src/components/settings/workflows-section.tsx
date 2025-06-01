import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { vscodeHost } from "@/lib/vscode";
import { getWorkflowPath } from "@/lib/workflow";
import { useQuery } from "@tanstack/react-query";
import { Edit, Workflow } from "lucide-react";
import { Section } from "./section";

export const WorkflowsSection: React.FC = () => {
  const { data: workflows, isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      return await vscodeHost.listWorkflowsInWorkspace();
    },
    refetchInterval: 3000,
  });

  const handleEditWorkflow = (workflowName: string) => {
    const workflowPath = getWorkflowPath(workflowName);
    vscodeHost.openFile(workflowPath);
  };

  return (
    <Section title="Workflows">
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full bg-secondary" />
          ))}
        </div>
      ) : workflows && workflows.length > 0 ? (
        <>
          {workflows.map(
            (workflow: { id: string; path: string; content: string }) => (
              <div key={workflow.id} className={cn("rounded-md border p-2")}>
                <div className="flex justify-between">
                  <div className="flex flex-1 items-center overflow-x-hidden">
                    <div className="flex size-6 shrink-0 items-center justify-center">
                      {<Workflow className="size-4 text-muted-foreground" />}
                    </div>
                    <span className="truncate font-semibold">
                      {workflow.id}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => handleEditWorkflow(workflow.id)}
                  >
                    <Edit className="size-3.5" />
                  </Button>
                </div>
              </div>
            ),
          )}
        </>
      ) : (
        <div className="text-muted-foreground text-sm">
          No workflows found in this workspace.
        </div>
      )}
    </Section>
  );
};
