import { useMcp } from "@/lib/hooks/use-mcp";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@radix-ui/react-tooltip";
import type { McpConnection } from "@ragdoll/vscode-webui-bridge";
import { Blocks, ChevronsUpDown, Dot, Github, RotateCw } from "lucide-react";
import { useState } from "react";
import { Badge } from "../ui/badge";
import { Button, buttonVariants } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Switch } from "../ui/switch";
import { Section } from "./section";

interface RecommendedMcpServer {
  id: string;
  name: string;
  description: string;
  githubUrl: string;
  command: string;
  args: string[];
}

const recommendedMcpServers: RecommendedMcpServer[] = [
  {
    id: "context7",
    name: "Context7",
    description:
      "Context7 pulls up-to-date, version-specific documentation and code examples straight from the source — and places them directly into your prompt, ensuring accurate and current programming assistance.",
    githubUrl: "https://github.com/upstash/context7",
    command: "npx",
    args: ["@upstash/context7-mcp"],
  },
];

export const McpSection: React.FC = () => {
  const rightElement = (
    <div className="mb-1 flex gap-1">
      {/* <a
        href={commandForMcp("addServer")}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <Plus className="size-4" />
        Add
      </a> */}
      <a
        href={commandForMcp("openServerSettings")}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <Blocks className="size-4" />
        Manage
      </a>
    </div>
  );

  return (
    <Section title={"MCP Servers"} rightElement={rightElement}>
      <Connections />
    </Section>
  );
};

const EmptyPlaceholder: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="flex justify-center rounded-md border px-2 py-2">
        <span className="flex items-center font-semibold">
          No MCP servers added yet.
        </span>
      </div>
      {recommendedMcpServers.length > 0 && (
        <div>
          <h4 className="mb-2 font-medium text-muted-foreground text-sm">
            Recommended MCP Servers
          </h4>
          <div className="space-y-2">
            {recommendedMcpServers.map((server) => (
              <RecommendedMcpCard
                key={server.id}
                id={server.id}
                name={server.name}
                description={server.description}
                githubUrl={server.githubUrl}
                command={server.command}
                args={server.args}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Connections: React.FC = () => {
  const { connections, isLoading } = useMcp();
  const keys = Object.keys(connections);

  return (
    <div className="w-full">
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex justify-between rounded-md border px-2 py-2">
            <Skeleton
              className="h-6 bg-secondary"
              style={{
                width: "15rem",
              }}
            />
          </div>
        ) : keys.length > 0 ? (
          keys.map((name) => {
            return (
              <Connection
                key={name}
                name={name}
                connection={connections[name]}
              />
            );
          })
        ) : (
          <EmptyPlaceholder />
        )}
      </div>
    </div>
  );
};

const Connection: React.FC<{
  name: string;
  connection: McpConnection;
}> = ({ name, connection }) => {
  const { status, error, tools } = connection;
  const [isOpen, setIsOpen] = useState(false);

  const hasTools = tools && Object.keys(tools).length > 0;

  return (
    <div className="rounded-md border px-2">
      <div className="group relative flex h-10 w-full items-center justify-between">
        <div
          className="flex flex-1 cursor-pointer items-center overflow-x-hidden"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Dot
            className={cn("size-6 shrink-0", {
              "text-muted-foreground": status === "stopped",
              "animate-pulse text-success": status === "starting",
              "text-success": status === "ready",
              "text-error": status === "error",
            })}
          />
          <span className="truncate font-semibold">{name}</span>
          {status === "error" && (
            <a
              href={commandForMcp("restartServer", name)}
              className={cn(
                "ml-2 rounded-md p-1 hover:bg-muted",
                "!ring-0 outline-none !focus:ring-0 focus:outline-none",
              )}
              draggable="false"
            >
              <RotateCw className="size-4 text-muted-foreground" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={commandForMcp(
              status === "stopped" ? "startServer" : "stopServer",
              name,
            )}
            className="flex items-center outline-none ring-0 ring-offset-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            draggable="false"
          >
            <Switch
              checked={status !== "stopped"}
              disabled={status === "starting"}
            />
          </a>
          <ChevronsUpDown
            className={cn("size-5 cursor-pointer", isOpen && "rotate-180")}
            onClick={() => setIsOpen(!isOpen)}
          />
        </div>
      </div>
      <div
        className={cn(
          "origin-top overflow-hidden transition-all duration-100 ease-in-out",
          isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        {status === "error" && (
          <>
            <hr className="border-muted" />
            <div className="flex w-full justify-center py-2 text-error">
              <p className="text-wrap">{error}</p>
            </div>
          </>
        )}
        {hasTools && (
          <>
            <hr className="border-muted" />
            <McpToolBadgeList serverName={name} tools={tools} />
          </>
        )}
      </div>
    </div>
  );
};

const McpToolBadgeList: React.FC<{
  serverName: string;
  tools: McpConnection["tools"];
}> = ({ serverName, tools }) => {
  const keys = Object.keys(tools);
  return (
    <TooltipProvider>
      <div className="flex w-full flex-wrap gap-2 py-2 ">
        {keys.length > 0 ? (
          keys.map((name) => (
            <McpToolBadge
              key={name}
              name={name}
              serverName={serverName}
              disabled={tools[name].disabled}
              description={tools[name].description}
            />
          ))
        ) : (
          <div className="flex w-full justify-center font-semibold">
            No tools available from this MCP server
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

const McpToolBadge: React.FC<{
  name: string;
  serverName: string;
  disabled?: boolean;
  description?: string;
}> = ({ name, serverName, description, disabled }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={commandForMcp("toogleToolEnabled", serverName, name)}
          rel="noopener noreferrer"
          className="cursor-pointer"
        >
          <Badge
            variant="secondary"
            className={cn({
              "line-through opacity-60": !!disabled,
            })}
          >
            {name}
          </Badge>
        </a>
      </TooltipTrigger>
      {description && (
        <TooltipContent className="max-w-80 bg-muted text-xs">
          <pre className={"text-wrap px-2 py-2"}>{description}</pre>
        </TooltipContent>
      )}
    </Tooltip>
  );
};

function commandForMcp(
  command:
    | "addServer"
    | "openServerSettings"
    | "startServer"
    | "stopServer"
    | "restartServer"
    | "toogleToolEnabled",
  serverName?: string,
  toolName?: string,
  recommendedServer?: {
    command: string;
    args: string[];
  },
): string {
  let cmd: string = command;
  let args: unknown[] = [];
  if (command === "startServer") {
    cmd = "serverControl";
    args = ["start", serverName];
  } else if (command === "stopServer") {
    cmd = "serverControl";
    args = ["stop", serverName];
  } else if (command === "restartServer") {
    cmd = "serverControl";
    args = ["restart", serverName];
  } else if (command === "toogleToolEnabled") {
    args = [serverName, toolName];
  } else if (command === "addServer" && recommendedServer) {
    args = [{ ...recommendedServer, name: serverName }];
  }

  return `command:ragdoll.mcp.${cmd}?${encodeURIComponent(JSON.stringify(args))}`;
}

interface RecommendedMcpCardProps {
  id: string;
  name: string;
  description: string;
  githubUrl: string;
  command: string;
  args: string[];
}

function RecommendedMcpCard({
  name,
  description,
  githubUrl,
  command,
  args,
}: RecommendedMcpCardProps) {
  return (
    <div className="rounded-lg border bg-card/70 p-6 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{name}</h3>
        <a
          href={commandForMcp("addServer", name, undefined, {
            command,
            args,
          })}
        >
          <Button size="sm">Add</Button>
        </a>
      </div>
      <a
        href={githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex items-center text-muted-foreground text-sm hover:text-foreground"
      >
        <Github className="mr-1 h-4 w-4" />
        View on GitHub
      </a>
      <p className="mt-4 text-muted-foreground text-sm">{description}</p>
      <div className="mt-4 flex items-center justify-between">
        <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
          {command} {args.join(" ")}
        </code>
        <span className="text-muted-foreground text-xs">Requires: npm</span>
      </div>
    </div>
  );
}
