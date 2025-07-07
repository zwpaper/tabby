import {
  GitStatusReader,
  collectCustomRules,
  getSystemInfo,
  listWorkspaceFiles,
} from "@ragdoll/common/node";
import type { Environment } from "@ragdoll/db";
import type { RunnerOptions } from "../task-runner";

/**
 * Read the environment for the task runner
 */
export const readEnvironment = async (
  context: Pick<RunnerOptions, "cwd">,
): Promise<Environment> => {
  const { cwd } = context;

  const { files, isTruncated } = await listWorkspaceFiles({
    cwd,
    recursive: true,
    maxItems: 500,
  });

  const customRules = await collectCustomRules(cwd);
  const systemInfo = getSystemInfo(cwd);
  const gitStatusReader = new GitStatusReader({ cwd });
  const gitStatus = await gitStatusReader.readGitStatus();

  const environment: Environment = {
    currentTime: new Date().toString(),
    workspace: {
      files,
      isTruncated,
      gitStatus,
      // Task runner doesn't have active tabs or selection like VSCode
      activeTabs: undefined,
      activeSelection: undefined,
    },
    info: {
      ...systemInfo,
      customRules,
    },
  };

  return environment;
};
