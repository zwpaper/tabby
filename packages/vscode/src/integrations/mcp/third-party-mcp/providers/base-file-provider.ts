import { homedir } from "node:os";
import * as path from "node:path";
import { isFileExists, readFileContent } from "@/lib/fs";
import { getLogger } from "@/lib/logger";
import * as vscode from "vscode";
import type { McpServerConfig } from "../../types";
import type { McpConfigProvider } from "../provider";

const logger = getLogger("BaseFileMcpProvider");

type ConfigFile = Record<string, unknown>;
type PathSegments = {
  darwin?: string[];
  linux?: string[];
  win32?: string[];
};

export abstract class BaseFileMcpProvider implements McpConfigProvider {
  abstract readonly name: string;
  abstract readonly description: string;
  protected abstract readonly pathSegments: PathSegments;

  private _configPath: string | undefined;
  private _pathResolved = false;

  private get configPath(): string | undefined {
    if (!this._pathResolved) {
      const currentPlatform = process.platform as keyof PathSegments;
      const segments = this.pathSegments[currentPlatform];
      this._configPath = segments ? expandPathSegments(segments) : undefined;
      this._pathResolved = true;
    }
    return this._configPath;
  }

  async getServers(): Promise<Record<string, McpServerConfig>> {
    if (
      !this.configPath ||
      !(await isFileExists(vscode.Uri.file(this.configPath)))
    ) {
      return {};
    }

    try {
      const content = await readFileContent(this.configPath);
      if (!content) {
        return {};
      }
      const config = JSON.parse(content) as ConfigFile;
      return (config.mcpServers as Record<string, McpServerConfig>) || {};
    } catch (error) {
      logger.debug(
        `Failed to get MCP servers from ${this.name}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      return {};
    }
  }

  getDisplayPath(): string | undefined {
    return this.configPath ? normalizePath(this.configPath) : undefined;
  }

  async openConfig(): Promise<void> {
    if (this.configPath) {
      const fileUri = vscode.Uri.file(this.configPath);
      await vscode.window.showTextDocument(fileUri, { preserveFocus: false });
    } else {
      vscode.window.showErrorMessage(
        `Configuration file for ${this.name} could not be found.`,
      );
    }
  }
}

function expandPathSegments(pathSegments: string[]): string {
  const homeDir = homedir() || process.env.HOME || "";
  const expandedSegments = pathSegments.map((segment) => {
    if (segment === "~") {
      return homeDir;
    }
    if (process.platform === "win32") {
      return segment.replace(/%([^%]+)%/g, (match, varName) => {
        return process.env[varName] || match;
      });
    }
    return segment.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
      return process.env[varName] || match;
    });
  });
  return path.join(...expandedSegments);
}

function normalizePath(filePath: string): string {
  const homeDir = homedir();
  if (filePath.startsWith(homeDir)) {
    return filePath.replace(homeDir, "~");
  }
  return filePath;
}
