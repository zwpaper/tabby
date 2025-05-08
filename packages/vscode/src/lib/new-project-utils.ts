import { getLogger } from "@/lib/logger";
import * as jszip from "jszip";
import generate from "project-name-generator";
import * as vscode from "vscode";

const logger = getLogger("newProjectUtils");

const homeUri = vscode.Uri.file(process.env.HOME || "~");
const baseUri = vscode.Uri.joinPath(homeUri, "PochiProjects");

async function createDirectoryIfNotExists(uri: vscode.Uri) {
  const exists = await vscode.workspace.fs.stat(uri).then(
    () => true,
    () => false,
  );
  if (!exists) {
    await vscode.workspace.fs.createDirectory(uri);
  }
}

export async function createNewProject(
  githubTemplateUrl?: string | undefined,
): Promise<vscode.Uri> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      cancellable: false,
    },
    async (progress) => {
      logger.info("Preparing new project...");
      progress.report({ message: "Pochi: Preparing new project..." });

      const projectName = generate().dashed;
      const projectUri = vscode.Uri.joinPath(baseUri, projectName);

      await createDirectoryIfNotExists(baseUri);
      await createDirectoryIfNotExists(projectUri);
      logger.info(`Created directory: ${projectUri}`);

      if (githubTemplateUrl) {
        await prepareProject(projectUri, githubTemplateUrl, progress);
      }

      return projectUri;
    },
  );
}

async function prepareProject(
  projectUri: vscode.Uri,
  githubTemplateUrl: string,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
) {
  const uri = vscode.Uri.parse(githubTemplateUrl);
  const zipArchiveUrl = uri
    .with({
      path: `${uri.path}/archive/refs/heads/main.zip`,
    })
    .toString();

  progress.report({ message: "Pochi: Fetching project template..." });
  logger.info(`Fetching project template from: ${zipArchiveUrl}`);

  // Fetch the zip file
  const response = await fetch(zipArchiveUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch project template: ${response.statusText}`);
  }
  const zipBuffer = await response.arrayBuffer();

  progress.report({ message: "Pochi: Extracting project template..." });
  logger.info(`Extracting project template to: ${projectUri}`);

  // Extract the zip
  const zip = await jszip.loadAsync(zipBuffer);
  for (const [filePath, file] of Object.entries(zip.files)) {
    const relativePaths = filePath.split(/[/\\]/).slice(1);
    const targetPath = vscode.Uri.joinPath(projectUri, ...relativePaths);

    if (file.dir) {
      await vscode.workspace.fs.createDirectory(targetPath);
    } else {
      const content = await file.async("uint8array");
      await vscode.workspace.fs.writeFile(targetPath, content);
    }
  }
}
