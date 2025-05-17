import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useIsDevMode } from "@/lib/hooks/use-is-dev-mode";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, EllipsisVertical } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_auth/settings")({
  component: SettingsPage,
});

interface SectionProps {
  children: React.ReactNode;
  className?: string;
}

const Section: React.FC<SectionProps> = ({ children, className }) => {
  return (
    <div className={cn("py-4", className)}>
      {/* <h2 className="mb-3 px-6 font-bold text-base">{title}</h2> */}
      <div>{children}</div>
    </div>
  );
};

const AccordionSection: React.FC<SectionProps & { title: string }> = ({
  title,
  children,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={className}>
      <button
        type="button"
        className="flex w-full items-center justify-between px-2 py-4 text-left focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-bold text-base">{title}</span>
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
          isOpen ? "max-h-[1000px] py-4 opacity-100" : "max-h-0 opacity-0",
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
        {" "}
        {/* Added px-6 here to maintain original padding for content within this specific section */}
        <a
          href="command:ragdoll.openAccountPage"
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
        {" "}
        {/* Added px-6 here to maintain original padding */}
        <a
          href="command:ragdoll.editWorkspaceRules"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border bg-secondary px-4 py-2 text-sm hover:bg-secondary/80"
        >
          Edit Rules
        </a>
        <span className="text-muted-foreground text-sm">
          Customize your rules for this workspace.
        </span>
      </div>
    </Section>
  );
};

const AdvancedSettingsSection: React.FC = () => {
  const isDevMode = useIsDevMode();

  return (
    <AccordionSection title="Advanced Settings">
      <div className="flex flex-col gap-4 px-6">
        {" "}
        {/* Added px-6 here as accordion content should likely retain its padding unless specified otherwise for its direct children */}
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
              className="font-bold text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Developer Mode
            </label>
          </div>
        )}
        {/* Add other advanced settings here */}
      </div>
    </AccordionSection>
  );
};

export function SettingsPage() {
  return (
    <div className="container mx-auto max-w-6xl p-4">
      <div>
        <AccountSection />
        <WorkspaceRulesSection />
        <Separator />
        <AdvancedSettingsSection />
      </div>
    </div>
  );
}
