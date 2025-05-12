import { getLogger } from "@/lib/logger";
import * as jszip from "jszip";
import generate from "project-name-generator";
import * as vscode from "vscode";
import { isFileExists } from "../fs";

const logger = getLogger("newProjectUtils");

const homeUri = vscode.Uri.file(process.env.HOME || "~");
const baseUri = vscode.Uri.joinPath(homeUri, "PochiProjects");

async function createDirectoryIfNotExists(uri: vscode.Uri) {
  const exists = await isFileExists(uri);
  if (!exists) {
    await vscode.workspace.fs.createDirectory(uri);
  }
}

export async function createNewWorkspace(
  namePlaceholder?: string | undefined,
): Promise<vscode.Uri | undefined> {
  await createDirectoryIfNotExists(baseUri);

  const { dashed } = generate();
  const namePrefix = namePlaceholder || "my-project";
  const placeholder = `${namePrefix}-${dashed}`;
  const projectName = await vscode.window.showInputBox({
    title: "Enter a name for the project",
    value: placeholder,
    valueSelection: [0, placeholder.length],
    ignoreFocusOut: true,
    validateInput: async (value) => {
      if (value.trim() === "") {
        return "Project name cannot be empty";
      }
      if (/[^a-zA-Z0-9-_]/.test(value)) {
        return "Project name can only contain letters, numbers, dashes and underscores";
      }
      const projectUri = vscode.Uri.joinPath(baseUri, value);
      if (await isFileExists(projectUri)) {
        return "Project directory already exists, please choose another name";
      }
      return undefined;
    },
  });
  if (!projectName) {
    return undefined;
  }
  const projectUri = vscode.Uri.joinPath(baseUri, projectName);

  await createDirectoryIfNotExists(projectUri);
  logger.info(`Created directory: ${projectUri}`);

  return projectUri;
}

export async function prepareProject(
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
  let response: Response;
  try {
    response = await fetch(zipArchiveUrl);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} ${response.statusText}.`);
    }
  } catch (error) {
    logger.error(`Failed to fetch project template: ${zipArchiveUrl}`, error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch project template. ${errorMessage}`);
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
