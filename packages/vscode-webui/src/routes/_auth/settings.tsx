import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsDevMode } from "@/lib/hooks/use-is-dev-mode";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, EllipsisVertical } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_auth/settings")({
  component: SettingsPage,
});

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const StaticSection: React.FC<SectionProps> = ({ title, children }) => {
  return (
    <div className="px-6 py-4">
      <h2 className="mb-3 font-medium text-lg">{title}</h2>
      <div>{children}</div>
    </div>
  );
};

const AccordionSection: React.FC<SectionProps> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        className="px-6 py-4 text-left focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-start">
          <span className="font-medium">{title}</span>
          <ChevronRight
            className={cn(
              "mr-2 size-5 shrink-0 text-[var(--vscode-descriptionForeground)] transition-transform duration-200 ease-in-out",
              isOpen ? "rotate-90 transform" : "",
            )}
          />
        </div>
      </button>
      <div
        className={cn(
          "origin-top overflow-hidden px-4 transition-all duration-100 ease-in-out",
          isOpen
            ? "max-h-[1000px] px-6 py-4 opacity-100"
            : "max-h-0 scale-y-90 opacity-0",
        )}
      >
        {children}
      </div>
    </div>
  );
};

const AccountSection: React.FC = () => {
  const { auth: authData } = Route.useRouteContext();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <StaticSection title="Account">
      <div className="flex items-center justify-between gap-2">
        <a
          href="command:ragdoll.openAccountPage"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
        >
          <Avatar className="size-12">
            <AvatarImage src={authData.user.image ?? undefined} />
            <AvatarFallback>{authData.user.name}</AvatarFallback>
          </Avatar>
          <strong>{authData.user.name || `USER-${authData.user.id}`}</strong>
          <span className="text-gray-600 text-sm dark:text-gray-400">
            {authData.user.email}
          </span>
        </a>
        <div className="relative">
          <button
            type="button"
            className="rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <EllipsisVertical className="size-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800">
              <a
                href="command:ragdoll.logout"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md px-4 py-2 text-gray-700 text-sm hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Sign Out
              </a>
            </div>
          )}
        </div>
      </div>
    </StaticSection>
  );
};

const WorkspaceRulesSection: React.FC = () => {
  return (
    <StaticSection title="Workspace Rules">
      <div className="flex items-center gap-2">
        <a
          href="command:ragdoll.editWorkspaceRules"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border px-4 py-2 hover:bg-secondary hover:text-secondary-foreground"
        >
          Edit Rules
        </a>
        <span className="text-gray-600 text-sm dark:text-gray-400">
          Your custom rules for this workspace.
        </span>
      </div>
    </StaticSection>
  );
};

const AdvancedSettingsSection: React.FC = () => {
  const isDevMode = useIsDevMode();

  return (
    <AccordionSection title="Advanced Settings">
      <div className="flex flex-col gap-4">
        {isDevMode !== undefined && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="dev-mode"
              checked={isDevMode.value}
              onCheckedChange={(checked) => {
                isDevMode.value = !!checked;
              }}
            />
            <label
              htmlFor="dev-mode"
              className="text-gray-700 text-sm dark:text-gray-300"
            >
              Dev Mode
            </label>
          </div>
        )}
      </div>
    </AccordionSection>
  );
};

export function SettingsPage() {
  return (
    <div className="container p-4">
      <div className="space-y-4">
        <AccountSection />
        <WorkspaceRulesSection />
        <AdvancedSettingsSection />
      </div>
    </div>
  );
}
