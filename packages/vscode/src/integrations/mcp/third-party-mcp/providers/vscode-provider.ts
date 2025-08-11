import { getLogger } from "@/lib/logger";
import * as vscode from "vscode";
import type { McpServerConfig } from "../../types";
import type { McpConfigProvider } from "../provider";

const logger = getLogger("VscodeMcpProvider");

export class VscodeMcpProvider implements McpConfigProvider {
  readonly name = "VSCode";
  readonly description = "VSCode User Settings MCP configuration";

  async getServers(): Promise<Record<string, McpServerConfig>> {
    try {
      const workspaceConfig = vscode.workspace.getConfiguration();
      const mcpSection = workspaceConfig.get<{
        servers?: Record<string, McpServerConfig>;
      }>("mcp");
      const mcpServers = mcpSection?.servers;

      // remove unnecessary vscode built-in mcp-server-time mcp
      if (mcpServers && "mcp-server-time" in mcpServers) {
        const { "mcp-server-time": _, ...filteredServers } = mcpServers;
        return filteredServers;
      }

      return mcpServers || {};
    } catch (error) {
      logger.debug(
        `Failed to get MCP servers from vscode config: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      return {};
    }
  }

  getDisplayPath(): string {
    return "VS Code Settings.json";
  }

  async openConfig(): Promise<void> {
    await vscode.commands.executeCommand("workbench.action.openSettingsJson", {
      revealSetting: { key: "mcp" },
    });
  }
}
