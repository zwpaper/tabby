// Modified from: https://github.com/TabbyML/tabby/blob/493cef3b3229548175de430dbc7f7e4a092ca507/clients/tabby-agent/src/contextProviders/git/gitCommand.ts

import { spawn } from "node:child_process";
import * as path from "node:path";
import { getLogger } from "@/lib/logger";
import { injectable, singleton } from "tsyringe";
import * as vscode from "vscode";
import type { GitRepository } from "./types";
import "../../utils/array"; // for distinct

const logger = getLogger("CodeCompletion.GitCommandRunner");

async function executeGitCommand(
  cwd?: string,
  args: string[] = [],
  token?: vscode.CancellationToken,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const git = spawn("git", args, {
      cwd,
    });
    let result = "";

    git.stdout.on("data", (data) => {
      result += data.toString();
    });

    git.on("error", (error) => {
      reject(
        `Git command error: ${error}, cwd: ${cwd}, args: ${args.join(" ")}`,
      );
    });

    const exitHandler = (code: number | null) => {
      if (code === 0) {
        resolve(result.trim());
      } else {
        reject(
          `Git command failed, code: ${code}, cwd: ${cwd}, args: ${args.join(" ")}`,
        );
      }
    };
    git.on("exit", exitHandler);
    git.on("close", exitHandler);

    if (token?.isCancellationRequested) {
      reject("The request is canceled.");
    }
    token?.onCancellationRequested(() => {
      reject("The request is canceled.");
    });
  });
}

async function ensureCwd(filepath: string): Promise<string> {
  const stats = await vscode.workspace.fs.stat(vscode.Uri.file(filepath));
  if (stats.type === vscode.FileType.Directory) {
    return filepath;
  }
  return path.dirname(filepath);
}

async function isGitCommandAvailable(): Promise<boolean> {
  try {
    const version = await executeGitCommand(undefined, ["--version"]);
    logger.debug(`Git command is available, ${version}.`);
    return true;
  } catch (e) {
    logger.debug(`Git command is not available. ${e}`);
    return false;
  }
}

async function getRepository(
  uri: vscode.Uri,
  token?: vscode.CancellationToken | undefined,
): Promise<GitRepository | null> {
  try {
    logger.trace("Get repository: ", { uri });
    const { scheme, path: filepath } = uri;
    if (scheme !== "file" || !filepath) {
      return null;
    }
    const cwd = await ensureCwd(filepath);
    const rootPath = await executeGitCommand(
      cwd,
      ["rev-parse", "--show-toplevel"],
      token,
    );
    const root = uri.with({ path: rootPath });
    const remoteOutput = await executeGitCommand(
      rootPath,
      ["remote", "-v"],
      token,
    );
    const remotes = remoteOutput
      .split("\n")
      .map((remoteLine) => {
        const [name, url] = remoteLine.trim().split(/\s+/);
        return { name, url };
      })
      .filter<{ name: string; url: string }>(
        (remote): remote is { name: string; url: string } => {
          return !!remote.name && !!remote.url;
        },
      )
      .distinct((item) => item.name);
    const result = { root, remotes };
    logger.trace("Get repository result: ", { result });
    return result;
  } catch (e) {
    logger.debug(`Failed to get repository for ${uri}. ${e}`);
    return null;
  }
}

@injectable()
@singleton()
export class GitCommandRunner {
  async getRepository(
    uri: vscode.Uri,
    token?: vscode.CancellationToken | undefined,
  ): Promise<GitRepository | null> {
    if (await isGitCommandAvailable()) {
      return getRepository(uri, token);
    }
    return null;
  }
}
