import type { TextUIPart, UIMessage } from "@ai-sdk/ui-utils";
import type { Environment, GitStatus } from "@ragdoll/db";

type User = { name: string; email: string };

export function getReadEnvironmentResult(
  environment: Environment,
  user: User | undefined,
) {
  const sections = [
    getSystemInfo(environment),
    getUserInfo(user),
    getWorkspaceFiles(environment.workspace, environment.info),
    getCurrentOpenedFiles(environment.workspace),
    getVisibleTerminals(environment.workspace),
    getCurrentWorkingFile(environment.workspace),
    getGitStatus(environment.workspace.gitStatus),
    getTodos(environment.todos),
  ]
    .filter(Boolean)
    .join("\n\n");
  return sections;
}

function getSystemInfo(environment: Environment) {
  const { info, currentTime } = environment;
  const prompt = `# System Information

Operating System: ${info.os}
Default Shell: ${info.shell}
Home Directory: ${info.homedir}
Current Working Directory: ${info.cwd}
Current Time: ${currentTime}

When the user initially gives you a task, a recursive list of all filepaths in the current working directory ('${info.cwd}') will be included in environment-details. This provides an overview of the project's file structure, offering key insights into the project from directory/file names (how developers conceptualize and organize their code) and file extensions (the language used). This can also guide decision-making on which files to explore further. If you need to further explore directories such as outside the current working directory, you can use the listFiles tool. If you pass 'true' for the recursive parameter, it will list files recursively. Otherwise, it will list files at the top level, which is better suited for generic directories where you don't necessarily need the nested structure, like the Desktop.
`;
  return prompt;
}

function getUserInfo(user: User | undefined) {
  if (!user) {
    return "";
  }

  const userInfo = [];
  if (user.name) {
    userInfo.push(`- Name: ${user.name}`);
  }

  if (user.email) {
    userInfo.push(`- Email: ${user.email}`);
  }

  if (userInfo.length > 0) {
    return `# User Information\n${userInfo.join("\n")}`;
  }

  return "";
}

function getWorkspaceFiles(
  workspace: Environment["workspace"],
  info: Environment["info"],
) {
  const { files, isTruncated } = workspace;
  const filesList = files.join("\n");
  const truncatedMessage = isTruncated
    ? "\n(Note: The list of files is truncated. Use listFiles tool to explore if needed)"
    : "";
  return `# Current Working Directory (${info.cwd}) Files\n${filesList}${truncatedMessage}`;
}

function getCurrentOpenedFiles(workspace: Environment["workspace"]) {
  const openFiles = workspace.activeTabs ?? [];
  if (openFiles.length === 0) {
    return "";
  }
  const header = `# Active File Tabs in Editor\nHere are the open file tabs in the editor. If a user mentions "this" or "that" without an active selection, they are likely referring active tab (if exists) below:`;
  return `${header}\n${openFiles
    .map((tab) => {
      if (typeof tab === "string") {
        return tab;
      }
      return tab.isActive ? `${tab.filepath} (active)` : tab.filepath;
    })
    .join("\n")}`;
}

function getVisibleTerminals(workspace: Environment["workspace"]) {
  const terminals = workspace.terminals ?? [];
  if (terminals.length === 0) {
    return "";
  }
  return `# Active Terminals in Editor\n${terminals
    .map((t) => (t.isActive ? `* ${t.name} (active)` : `  ${t.name}`))
    .join("\n")}`;
}

function getCurrentWorkingFile(workspace: Environment["workspace"]) {
  const selection = workspace.activeSelection;
  if (!selection) {
    return "";
  }
  const { filepath, range, content } = selection;
  if (!content || content.trim() === "") {
    return "";
  }
  return `# Active Selection (${filepath}:${range.start.line + 1}-${range.end.line + 1})\n\n\`\`\`\n${content}\n\`\`\`\n`;
}

function getGitStatus(gitStatus: GitStatus | undefined) {
  if (!gitStatus) return "# GIT STATUS\nThis workspace is not managed by git";

  const { currentBranch, mainBranch, status, recentCommits } = gitStatus;

  let result = "# GIT STATUS\n";

  if (gitStatus.origin) {
    result += `Origin: ${gitStatus.origin}\n`;
  }
  result += `Current branch: ${currentBranch}\n`;
  result += `Main branch (you will usually use this for PRs): ${mainBranch}\n\n`;

  if (status) {
    result += `Status:\n${status}\n\n`;
  }

  if (recentCommits.length > 0) {
    result += `Recent commits:\n${recentCommits.join("\n")}`;
  }

  return result;
}

export function stripEnvironmentDetails(messages: UIMessage[]) {
  for (const message of messages) {
    message.parts = message.parts.filter((part) => {
      if (part.type !== "text") return true;
      return !part.text.startsWith(`<${EnvironmentDetailsTag}>`);
    });
  }
  return messages;
}

function getInjectMessage(messages: UIMessage[]) {
  const lastMessage = messages.at(-1);
  if (!lastMessage) return;
  if (lastMessage.role === "user") return lastMessage;
}

/**
 * Injects environment details into the messages.
 *
 * @param messages - The array of UI messages.
 * @param environment - The environment object containing workspace and todos.
 * @param event - The user event that triggered this task.
 * @returns The updated array of UI messages with injected environment details.
 */
export function injectEnvironmentDetails(
  messages: UIMessage[],
  environment: Environment | undefined,
  user: User | undefined,
) {
  if (environment === undefined) return messages;
  const messageToInject = getInjectMessage(messages);
  if (!messageToInject) return messages;

  const textPart = {
    type: "text",
    text: `<${EnvironmentDetailsTag}>\n${getReadEnvironmentResult(
      environment,
      user,
    )}\n</${EnvironmentDetailsTag}>`,
  } satisfies TextUIPart;

  const parts = messageToInject.parts || [];

  if (messageToInject.role === "user") {
    messageToInject.parts = [textPart, ...parts];
  }

  return messages;
}

function getTodos(todos: Environment["todos"]) {
  if (todos === undefined || todos.length === 0) {
    return "# TODOs\nNo TODOs yet, if you are working on tasks that would benefit from a todo list please use the todoWrite tool to create one.";
  }

  return `# TODOs
Here's todo list for current task. If a task is marked as cancelled or completed, it no longer needs your attention, NEVER ATTEMPT TO COMPLETE IT AGAIN, this is SUPER IMPORTANT!!!.
Otherwise, please follow the todo list to complete the task.

${JSON.stringify(todos, null, 2)}`;
}

const EnvironmentDetailsTag = "environment-details";
