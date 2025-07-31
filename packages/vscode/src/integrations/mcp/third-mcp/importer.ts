import { homedir } from "node:os";
import * as path from "node:path";
import { isFileExists, readFileContent } from "@/lib/fs";
import { getLogger } from "@/lib/logger";
import { injectable, singleton } from "tsyringe";
import * as vscode from "vscode";
// biome-ignore lint/style/useImportType: needed for dependency injection
import { McpHub } from "../mcp-hub";
import type { McpServerConfig } from "../types";
import {
  type McpAppConfig,
  McpAppConfigs,
  type McpConfigPath,
} from "./constants";

const logger = getLogger("ThirdMcpImporter");

type ConfigFile = Record<string, unknown>;

@injectable()
@singleton()
export class ThirdMcpImporter {
  private readonly isSupported: boolean;

  constructor(private readonly mcpHub: McpHub) {
    // FIXME(sma1lboy): validation linux filepath later
    this.isSupported = process.platform !== "linux";
  }

  // Read and parse configuration file
  private async readConfigFile(filePath: string): Promise<ConfigFile> {
    try {
      const content = await readFileContent(filePath);
      if (!content) {
        throw new Error("File not found or could not be read");
      }
      return JSON.parse(content) as ConfigFile;
    } catch (error) {
      throw new Error(
        `Failed to read config file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Get MCP servers from configuration file
  private async getMcpServers(
    configPath: McpConfigPath,
  ): Promise<Record<string, McpServerConfig>> {
    try {
      const config = await this.readConfigFile(configPath.path);
      return config.mcpServers as Record<string, McpServerConfig>;
    } catch (error) {
      logger.debug(
        `Failed to get MCP servers from ${configPath.name}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return {};
    }
  }

  // Resolve MCP configuration paths - only supports macOS for now
  private resolveMcpConfigPaths(): McpConfigPath[] {
    if (!this.isSupported) {
      return [];
    }

    const currentPlatform = process.platform as keyof McpAppConfig["paths"];
    const paths: McpConfigPath[] = [];

    for (const appConfig of McpAppConfigs) {
      const pathSegments = appConfig.paths[currentPlatform];
      if (pathSegments) {
        paths.push({
          name: appConfig.name,
          path: expandPathSegments(pathSegments),
          description: appConfig.description,
        });
      }
    }

    return paths;
  }

  // Get available MCP configuration files that actually contain servers
  async getAvailableConfigs(): Promise<McpConfigPath[]> {
    const allPaths = this.resolveMcpConfigPaths();
    const existingPaths = await checkConfigFilesExist(allPaths);
    // Filter out configs that don't have any servers
    const pathsWithServers: McpConfigPath[] = [];
    for (const configPath of existingPaths) {
      const servers = await this.getMcpServers(configPath);
      if (Object.keys(servers).length > 0) {
        pathsWithServers.push(configPath);
      }
    }

    return pathsWithServers;
  }

  // Import MCP servers from a specific configuration file
  async importFromConfig(configPath: McpConfigPath): Promise<void> {
    const servers = await this.getMcpServers(configPath);
    const currentConfig = this.mcpHub.getCurrentConfig();
    const serversToImport: Array<McpServerConfig & { name: string }> = [];

    for (const [serverName, serverConfig] of Object.entries(servers)) {
      if (currentConfig[serverName]) {
        continue;
      }

      serversToImport.push({ name: serverName, ...serverConfig });
    }

    if (serversToImport.length === 0) {
      return;
    }

    // Use McpHub's new addServers method for batch import
    this.mcpHub.addServers(serversToImport);
  }

  // Import MCP servers from all available configuration files
  async importFromAllConfigs(): Promise<void> {
    const availableConfigs = await this.getAvailableConfigs();
    const currentConfig = this.mcpHub.getCurrentConfig();
    const allServersToImport: Array<McpServerConfig & { name: string }> = [];

    // First, collect all servers from all configs
    for (const configPath of availableConfigs) {
      const servers = await this.getMcpServers(configPath);

      for (const [serverName, serverConfig] of Object.entries(servers)) {
        if (currentConfig[serverName]) {
          continue;
        }

        allServersToImport.push({ name: serverName, ...serverConfig });
      }
    }

    if (allServersToImport.length === 0) {
      return;
    }

    // Use McpHub's new addServers method for batch import
    this.mcpHub.addServers(allServersToImport);
  }
}

/**
 * Check if MCP config files exist for given paths
 */
async function checkConfigFilesExist(
  configPaths: Array<{ name: string; path: string; description: string }>,
): Promise<Array<{ name: string; path: string; description: string }>> {
  const availablePaths: Array<{
    name: string;
    path: string;
    description: string;
  }> = [];

  for (const configPath of configPaths) {
    const fileUri = vscode.Uri.file(configPath.path);
    if (await isFileExists(fileUri)) {
      availablePaths.push(configPath);
    }
  }

  return availablePaths;
}

/**
 * Expand path segments with environment variables and home directory
 */
function expandPathSegments(pathSegments: string[]): string {
  const homeDir = homedir() || process.env.HOME || "";
  const expandedSegments = pathSegments.map((segment) => {
    if (segment === "~") {
      return homeDir;
    }
    if (process.platform === "win32") {
      // Replace all Windows environment variables in format %VAR%
      return segment.replace(/%([^%]+)%/g, (match, varName) => {
        return process.env[varName] || match;
      });
    }
    // Handle Unix-style environment variables on non-Windows platforms
    return segment.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
      return process.env[varName] || match;
    });
  });
  return path.join(...expandedSegments);
}

/**
 * Normalize path for display (replace home directory with ~)
 */
export function normalizePath(filePath: string): string {
  const homeDir = homedir();
  if (filePath.startsWith(homeDir)) {
    return filePath.replace(homeDir, "~");
  }
  return filePath;
}
