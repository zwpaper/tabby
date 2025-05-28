import { useMcp } from "@/lib/hooks/use-mcp";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@radix-ui/react-tooltip";
import type { McpConnection } from "@ragdoll/vscode-webui-bridge";
import { Blocks, ChevronsUpDown, Dot, Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "../ui/badge";
import { buttonVariants } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Section } from "./section";

export const McpSection: React.FC = () => {
  const { connections } = useMcp();

  // FIXME(zhiming): Skip if there are no connections for now
  if (Object.keys(connections).length === 0) {
    return null;
  }

  // FIXME(zhiming): hardcode hide buttons for now
  const rightElement = false && (
    <div className="mb-1 flex gap-1">
      <a
        href={commandForMcp("addServer")}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <Plus className="size-4" />
        Add
      </a>
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
          <div className="flex justify-center rounded-md border px-2 py-2">
            <span className="flex items-center font-semibold">
              No MCP servers connected
            </span>
          </div>
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

  return (
    <div className="rounded-md border px-2">
      <button
        type="button"
        className="group relative flex h-10 w-full items-center justify-between focus:outline-none"
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          if ((e.target as HTMLElement).closest("a")) {
            // If the click was a command link, do nothing in this handler.
            return;
          }
          // Otherwise, toggle the isOpen state.
          setIsOpen(!isOpen);
        }}
      >
        <span className="flex items-center font-semibold">
          <Dot
            className={cn("size-6", {
              "text-muted-foreground": status === "stopped",
              "animate-pulse text-green-400": status === "starting",
              "text-green-400": status === "ready",
              "text-red-400": status === "error",
            })}
          />
          {name}
        </span>
        <span className="flex items-center">
          {false && ( // FIXME(zhiming): hardcode hide buttons for now
            <span className="opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
              {status === "stopped" && (
                <a
                  href={commandForMcp("startServer", name)}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Start
                </a>
              )}

              {status === "error" && (
                <a
                  href={commandForMcp("restartServer", name)}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Restart
                </a>
              )}

              {status === "ready" && (
                <a
                  href={commandForMcp("stopServer", name)}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Stop
                </a>
              )}
            </span>
          )}
          <ChevronsUpDown className="size-5" />
        </span>
      </button>
      <div
        className={cn(
          "origin-top overflow-hidden transition-all duration-100 ease-in-out",
          isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        {status === "error" && (
          <>
            <hr className="border-muted" />
            <div className="flex w-full justify-center py-2 text-red-400">
              <p className="text-wrap">{error}</p>
            </div>
          </>
        )}
        <>
          <hr className="border-muted" />
          <McpToolBadgeList serverName={name} tools={tools} />
        </>
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
  }

  // @ts-ignore TS6133: 'link' not used
  const link = `command:ragdoll.mcp.${cmd}?${encodeURIComponent(JSON.stringify(args))}`;

  // FIXME(zhiming): hardcode return no command link for now
  // return link;
  return "";
}
