import { Section } from "@/components/settings/section";
import { SettingsCheckboxOption } from "@/components/settings/settings-checkbox-option";
import { ToolsSection } from "@/components/settings/tools-section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsDevMode } from "@/lib/hooks/use-is-dev-mode";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { cn } from "@/lib/utils";
import { getServerBaseUrl } from "@ragdoll/vscode-webui-bridge";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, EllipsisVertical } from "lucide-react";
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
        <span className="ml-1 font-bold text-base">{title}</span>
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
    <Section>
      <div className="flex items-center justify-between gap-3">
        <a
          href={`${getServerBaseUrl()}/account`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-grow items-center gap-3 rounded-md p-2 hover:bg-secondary"
        >
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
        </a>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-full p-2 hover:bg-secondary"
              aria-label="Account options"
            >
              <EllipsisVertical className="size-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild className="cursor-pointer">
              <a
                href="command:ragdoll.logout"
                target="_blank"
                rel="noopener noreferrer"
              >
                Sign Out
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Section>
  );
};

const WorkspaceRulesSection: React.FC = () => {
  return (
    <Section>
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
    </Section>
  );
};

const AdvancedSettingsSection: React.FC = () => {
  const [isDevMode, setIsDevMode] = useIsDevMode();
  const { enableTodos, updateEnableTodos } = useSettingsStore();
  const { showThinking, updateShowThinking } = useSettingsStore();

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
          id="enable-todos"
          label="Enable Todos"
          checked={enableTodos}
          onCheckedChange={(checked) => {
            updateEnableTodos(!!checked);
          }}
        />
        <SettingsCheckboxOption
          id="show-thinking"
          label="Show Thinking"
          checked={showThinking}
          onCheckedChange={(checked) => {
            updateShowThinking(!!checked);
          }}
        />
      </div>
    </AccordionSection>
  );
};

export function SettingsPage() {
  return (
    <div className="container mx-auto max-w-6xl p-4">
      <div className="space-y-1">
        <AccountSection />
        <WorkspaceRulesSection />
        <ToolsSection />
        <AdvancedSettingsSection />
      </div>
    </div>
  );
}
