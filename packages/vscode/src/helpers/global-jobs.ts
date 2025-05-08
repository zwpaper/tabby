import { getLogger } from "@/lib/logger";
import * as vscode from "vscode";

export interface GlobalJob {
  // should get from vscode.Uri.toString()
  workspaceUri: string;

  // registered command id
  command: string;

  // command args
  args: unknown[];

  // Runner check job every 1000ms, job will not be executed if it is expired
  expiresAt: number;
}

const logger = getLogger("GlobalJobsRunner");

export class GlobalJobsRunner implements vscode.Disposable {
  static GlobalJobsCommandKey = "global_jobs";

  private readonly runner = setInterval(async () => {
    await this.run();
  }, 1000);

  constructor(private readonly context: vscode.ExtensionContext) {}

  async push(job: GlobalJob): Promise<void> {
    const commands = this.context.globalState.get<GlobalJob[]>(
      GlobalJobsRunner.GlobalJobsCommandKey,
      [],
    );
    commands.push(job);
    logger.debug(`Pushing job ${JSON.stringify(job)}`);
    await this.context.globalState.update(
      GlobalJobsRunner.GlobalJobsCommandKey,
      commands,
    );
  }

  private async run() {
    const jobs = this.context.globalState.get<GlobalJob[]>(
      GlobalJobsRunner.GlobalJobsCommandKey,
      [],
    );

    // extract the current workspace job
    const currentWorkspaceJob = jobs.filter(
      (job) =>
        job.workspaceUri ===
        vscode.workspace.workspaceFolders?.[0].uri.toString(),
    );

    // update registry with the rest of the jobs
    await this.context.globalState.update(
      GlobalJobsRunner.GlobalJobsCommandKey,
      jobs.filter((job) => currentWorkspaceJob.indexOf(job) === -1),
    );

    // run the jobs
    for (const job of currentWorkspaceJob) {
      if (job.expiresAt <= Date.now()) {
        logger.debug(`Job ${JSON.stringify(job)} expired.`);
        continue;
      }
      logger.debug(`Running job ${JSON.stringify(job)}.`);
      await vscode.commands.executeCommand(job.command, ...job.args);
    }
  }

  dispose() {
    clearInterval(this.runner);
  }
}
