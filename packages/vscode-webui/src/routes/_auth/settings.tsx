import { McpSection } from "@/components/settings/mcp-section";
import { Section } from "@/components/settings/section";
import { SettingsCheckboxOption } from "@/components/settings/settings-checkbox-option";
import { ToolsSection } from "@/components/settings/tools-section";
import { FileList } from "@/components/tool-invocation/file-list";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/auth-client";
import { useIsDevMode } from "@/lib/hooks/use-is-dev-mode";
import { useThirdPartyRules } from "@/lib/hooks/use-third-party-rules";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { cn } from "@/lib/utils";
import { vscodeHost } from "@/lib/vscode";
import { getWorkflowPath } from "@/lib/workflow";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronsUpDown,
  Download,
  Edit,
  Loader2,
  LogOut,
  Workflow,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_auth/settings")({
  component: SettingsPage,
});

interface AccordionSectionProps {
  children: React.ReactNode;
  className?: string;
  title: string;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  children,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("py-6", className)}>
      <button
        type="button"
        className="mb-4 flex w-full items-center justify-between text-left focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="ml-1 select-none font-bold text-base">{title}</span>
        <ChevronLeft
          className={cn(
            "size-5 shrink-0 text-muted-foreground transition-transform duration-200 ease-in-out",
            isOpen ? "-rotate-90" : "",
          )}
        />
      </button>
      <div
        className={cn(
          "origin-top overflow-hidden transition-all duration-100 ease-in-out",
          isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        {children}
      </div>
    </div>
  );
};

const AccountSection: React.FC = () => {
  const { auth: authData } = Route.useRouteContext();

  return (
    <Section className="pt-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex flex-grow cursor-pointer items-center justify-between gap-3 rounded-md p-2 hover:bg-secondary">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarImage src={authData.user.image ?? undefined} />
                <AvatarFallback>
                  {authData.user.name
                    ? authData.user.name.charAt(0).toUpperCase()
                    : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-semibold">
                  {authData.user.name || `USER-${authData.user.id}`}
                </span>
                {authData.user.email && (
                  <span className="text-muted-foreground text-sm">
                    {authData.user.email}
                  </span>
                )}
              </div>
            </div>
            <ChevronsUpDown className="size-5" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild className="cursor-pointer">
            <a
              href="command:ragdoll.logout"
              target="_blank"
              rel="noopener noreferrer"
            >
              <LogOut className="size-4" />
              Sign Out
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Quota />
    </Section>
  );
};

const WorkspaceRulesSection: React.FC = () => {
  const { rulePaths, importThirdPartyRules, isImporting, workspaceRuleExists } =
    useThirdPartyRules();

  const hasThirdPartyRules = rulePaths.length > 0;

  const importRules = async () => {
    await importThirdPartyRules();
    vscodeHost.capture({
      event: "importThirdPartyRules",
      properties: {
        rulePaths,
      },
    });
  };

  return (
    <Section title="Rules">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <a
            href="command:ragdoll.editWorkspaceRules"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "secondary" })}
          >
            Edit Rules
          </a>
          <span className="text-muted-foreground text-sm">
            Customize rules for Pochi in this workspace.
          </span>
        </div>

        {/* Cursor Rules Status Section - Only show if detecting or rules found */}
        {!workspaceRuleExists && hasThirdPartyRules && (
          <div className="rounded-md border p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-medium text-sm">Import Rules</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Found {rulePaths.length} rules
                  {rulePaths.length === 1 ? "" : "s"}
                </span>
                <Button
                  onClick={importRules}
                  disabled={isImporting}
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                >
                  {(() => {
                    if (isImporting) {
                      return (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          Importing...
                        </>
                      );
                    }

                    return (
                      <>
                        <Download className="mr-1 size-3" />
                        Import
                      </>
                    );
                  })()}
                </Button>
              </div>
              <FileList matches={rulePaths.map((path) => ({ file: path }))} />
            </div>
          </div>
        )}
      </div>
    </Section>
  );
};

const WorkflowsSection: React.FC = () => {
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

const AdvancedSettingsSection: React.FC = () => {
  const [isDevMode, setIsDevMode] = useIsDevMode();
  const { enableReasoning, updateEnableReasoning } = useSettingsStore();

  return (
    <AccordionSection title="Advanced Settings">
      <div className="flex flex-col gap-4 px-6">
        {isDevMode !== undefined && (
          <SettingsCheckboxOption
            id="dev-mode"
            label="Developer Mode"
            checked={isDevMode}
            onCheckedChange={(checked) => {
              setIsDevMode(!!checked);
            }}
          />
        )}
        <SettingsCheckboxOption
          id="enable-reasoning"
          label="Enable Reasoning"
          checked={enableReasoning}
          onCheckedChange={(checked) => {
            updateEnableReasoning(!!checked);
          }}
        />
      </div>
    </AccordionSection>
  );
};

const Quota: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["billingQuota"],
    queryFn: async () => {
      const res = await apiClient.api.billing.quota.me.$get();
      if (!res.ok) {
        throw new Error("Failed to fetch quota");
      }
      return await res.json();
    },
  });

  if (isLoading) {
    return <Skeleton className="h-17 w-full bg-secondary" />;
  }

  if (error) {
    return null;
  }

  if (!data) {
    return null;
  }

  const { usages, limits } = data;
  const basicUsagePercent =
    limits.basic > 0 ? Math.min((usages.basic / limits.basic) * 100, 100) : 0;
  const premiumUsagePercent =
    limits.premium > 0
      ? Math.min((usages.premium / limits.premium) * 100, 100)
      : 0;

  return (
    <div className="select-none px-2">
      <div className="space-y-2">
        {data.plan === "Community" && (
          <div className="flex flex-col gap-1">
            <div className="mb-0.5 flex justify-between text-sm">
              <span className="text-muted-foreground">Basic</span>
              <span className="font-mono">
                {usages.basic} / {limits.basic}
              </span>
            </div>
            <div className="h-1 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-1 rounded-full bg-primary"
                style={{ width: `${basicUsagePercent}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <div className="mb-0.5 flex justify-between text-sm">
            <span className="text-muted-foreground">Premium</span>
            <span className="font-mono">
              {usages.premium} / {limits.premium}
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-1 rounded-full bg-primary"
              style={{ width: `${premiumUsagePercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export function SettingsPage() {
  return (
    <div className="container mx-auto h-screen max-w-6xl">
      <ScrollArea className="h-full p-4">
        <div className="space-y-1">
          <AccountSection />
          <WorkspaceRulesSection />
          <WorkflowsSection />
          <ToolsSection />
          <McpSection />
          <AdvancedSettingsSection />
        </div>
      </ScrollArea>
    </div>
  );
}
