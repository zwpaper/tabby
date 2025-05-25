import type { TextUIPart, UIMessage } from "@ai-sdk/ui-utils";
import type { Environment, UserEvent } from "@ragdoll/common";

const InjectReadEnvironmentInAssistantMessage = false;

export function getReadEnvironmentResult(
  environment: Environment,
  event: UserEvent | null,
) {
  const sections = [
    getCurrentTime(environment.currentTime),
    getWorkspaceFiles(environment.workspace, environment.info),
    getCurrentOpenedFiles(environment.workspace),
    getCurrentWorkingFile(environment.workspace),
    getGitStatus(environment.info.gitStatus),
    getEvent(event),
    getTodos(environment.todos),
  ]
    .filter(Boolean)
    .join("\n\n");
  return sections;
}

function getCurrentTime(currentTime: string) {
  if (currentTime) {
    return `# Current Time\n${currentTime}`;
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
  return `# Active File Tabs in Editor\n${openFiles.join("\n")}`;
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

function getEvent(event: UserEvent | null) {
  if (event) {
    return `# Event triggered this task\n${JSON.stringify(event, null, 2)}`;
  }
  return "";
}

function getGitStatus(gitStatus: string | undefined) {
  if (!gitStatus) return "";
  return `# GIT STATUS\nthis git status will keep latest changes in the repository.\n${gitStatus}`;
}

export function stripEnvironmentDetails(messages: UIMessage[]) {
  for (const message of messages) {
    message.parts = message.parts.filter((part) => {
      if (part.type !== "text") return true;
      return !part.text.startsWith("<environment-details>");
    });
  }
  return messages;
}

function getInjectMessage(messages: UIMessage[]) {
  const lastMessage = messages.at(-1);
  if (!lastMessage) return;
  if (lastMessage.role === "user") return lastMessage;
  if (lastMessage.role === "assistant") {
    if (InjectReadEnvironmentInAssistantMessage) {
      return lastMessage;
    }

    return getInjectMessage(messages.slice(0, -1));
  }
}

export function injectEnvironmentDetails(
  messages: UIMessage[],
  environment: Environment | undefined,
  event: UserEvent | null,
) {
  if (environment === undefined) return messages;
  const messageToInject = getInjectMessage(messages);
  if (!messageToInject) return messages;

  const textPart = {
    type: "text",
    text: `<environment-details>\n${getReadEnvironmentResult(environment, event)}\n</environment-details>`,
  } satisfies TextUIPart;

  const parts = messageToInject.parts || [];

  if (messageToInject.role === "user") {
    messageToInject.parts = [textPart, ...parts];
  }

  if (messageToInject.role === "assistant") {
    const lastStepStartIndex = parts.reduce((lastIndex, part, index) => {
      return part.type === "step-start" ? index : lastIndex;
    }, -1);

    // insert textPart after stepStart
    if (lastStepStartIndex !== -1) {
      parts.splice(lastStepStartIndex + 1, 0, textPart);
    } else {
      parts.unshift(textPart);
    }
  }

  return messages;
}

function getTodos(todos: Environment["todos"]) {
  if (todos === undefined) {
    return "";
  }

  if (todos.length === 0) {
    return "# TODOs\nNo TODOs yet, if you are working on tasks that would benefit from a todo list please use the todoWrite tool to create one.";
  }

  return `# TODOs\n${JSON.stringify(todos, null, 2)}`;
}
