import { AccountSection } from "@/components/settings/account-section";
import { AdvancedSettingsSection } from "@/components/settings/advanced-settings-section";
import { ToolsSection } from "@/components/settings/tools-section";
import { WorkflowsSection } from "@/components/settings/workflows-section";
import { WorkspaceRulesSection } from "@/components/settings/workspace-rules-section";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/settings")({
  component: SettingsPage,
});

export function SettingsPage() {
  const { auth: authData } = Route.useRouteContext();

  return (
    <div className="container mx-auto h-screen max-w-6xl">
      <ScrollArea className="h-full p-4">
        <div className="space-y-1">
          <AccountSection user={authData.user} />
          <WorkspaceRulesSection />
          <WorkflowsSection />
          <ToolsSection />
          <AdvancedSettingsSection />
        </div>
      </ScrollArea>
    </div>
  );
}
