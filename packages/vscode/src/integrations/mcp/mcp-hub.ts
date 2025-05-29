import { getLogger } from "@/lib/logger";
import { type Signal, signal } from "@preact/signals-core";
import type { McpTool } from "@ragdoll/vscode-webui-bridge";
import { inject, injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";
// biome-ignore lint/style/useImportType: needed for dependency injection
import {
  PochiConfiguration,
  type PochiMcpServersSettings,
} from "../configuration";
import { McpConnection } from "./mcp-connection";
import type { McpServerConfig, McpToolExecutable } from "./types";
import { omitDisabled } from "./types";

const logger = getLogger("MCPHub");

type McpConnectionStatus = McpConnection["status"]["value"];
type McpConnectionMap = Map<
  string,
  {
    instance: McpConnection;
    listener: vscode.Disposable;
  }
>;

@injectable()
@singleton()
export class McpHub implements vscode.Disposable {
  private connections: McpConnectionMap = new Map();
  private listeners: vscode.Disposable[] = [];
  private config: PochiMcpServersSettings | undefined = undefined;

  readonly status: Signal<ReturnType<typeof this.buildStatus>>;

  constructor(
    @inject("vscode.ExtensionContext")
    private readonly context: vscode.ExtensionContext,
    private readonly configuration: PochiConfiguration,
  ) {
    this.status = signal(this.buildStatus());
    this.init();
  }

  restart(name: string) {
    const connection = this.connections.get(name);
    if (connection) {
      connection.instance.restart();
    } else {
      logger.debug(`Tried to restart non-existing connection: ${name}`);
    }
  }

  start(name: string) {
    if (this.config?.[name]) {
      this.updateServerConfig(name, { ...this.config[name], disabled: false });
    } else {
      logger.debug(`Tried to start non-existing server: ${name}`);
    }
  }

  stop(name: string) {
    if (this.config?.[name]) {
      this.updateServerConfig(name, { ...this.config[name], disabled: true });
    } else {
      logger.debug(`Tried to stop non-existing server: ${name}`);
    }
  }

  private updateServerConfig(name: string, newConfig: McpServerConfig) {
    if (!this.config) return;

    const updatedConfig = {
      ...this.config,
      [name]: newConfig,
    };

    this.configuration.mcpServers.value = updatedConfig;
    logger.debug(`Updated configuration for server ${name}:`, newConfig);
  }

  private init() {
    const mcpServersConfig = this.configuration.mcpServers.value;
    this.config = mcpServersConfig;
    logger.trace("Initializing MCP Hub with config:", mcpServersConfig);
    for (const [name, config] of Object.entries(mcpServersConfig)) {
      this.createConnection(name, config);
    }

    this.listeners.push({
      dispose: this.configuration.mcpServers.subscribe((newConfig) => {
        logger.debug("MCP servers configuration changed:", newConfig);
        this.config = newConfig;

        // Update existing connections
        for (const [name, config] of Object.entries(newConfig)) {
          if (this.connections.has(name)) {
            this.updateConnection(name, config);
          } else {
            this.createConnection(name, config);
          }
        }

        // Remove connections that are no longer in the config
        for (const name of this.connections.keys()) {
          if (!(name in newConfig)) {
            this.removeConnection(name);
          }
        }

        this.updateStatus();
      }),
    });
  }

  private updateStatus() {
    this.status.value = this.buildStatus();
    logger.trace("Status updated:", this.status.value);
  }

  private buildStatus() {
    const connections = Object.keys(this.config ?? {}).reduce<
      Record<string, McpConnectionStatus>
    >((acc, name) => {
      const connection = this.connections.get(name);
      if (connection) {
        acc[name] = connection.instance.status.value;
      }
      return acc;
    }, {});

    const toolset = Object.entries(connections).reduce<
      Record<string, McpTool & McpToolExecutable>
    >((acc, [, connection]) => {
      if (connection.status === "ready") {
        const tools = Object.entries(connection.tools).reduce<
          Record<string, McpTool & McpToolExecutable>
        >((toolAcc, [toolName, tool]) => {
          if (!tool.disabled) {
            toolAcc[toolName] = {
              ...omitDisabled(tool),
            };
          }
          return toolAcc;
        }, {});
        Object.assign(acc, tools);
      }
      return acc;
    }, {});

    return {
      connections,
      toolset,
    };
  }

  private createConnection(name: string, config: McpServerConfig) {
    const connection = new McpConnection(name, this.context, config);
    const listener = {
      dispose: connection.status.subscribe(() => {
        logger.debug(`Connection status updated for ${name}`);
        this.updateStatus();
      }),
    };
    this.connections.set(name, {
      instance: connection,
      listener,
    });
    logger.debug(`Connection ${name} created.`);
  }

  private updateConnection(name: string, config: McpServerConfig) {
    const connection = this.connections.get(name);
    if (connection) {
      logger.debug(`Updating ${name} with new config.`);
      connection.instance.updateConfig(config);
    }
  }

  private removeConnection(name: string) {
    const connection = this.connections.get(name);
    if (connection) {
      connection.listener.dispose();
      connection.instance.dispose();
      this.connections.delete(name);
      logger.debug(`Connection ${name} removed.`);
    }
  }

  dispose() {
    for (const listener of this.listeners) {
      listener.dispose();
    }
    this.listeners = [];

    for (const connection of Object.values(this.connections)) {
      connection.listener.dispose();
      connection.instance.dispose();
    }
    this.connections.clear();
    this.updateStatus();
  }
}
