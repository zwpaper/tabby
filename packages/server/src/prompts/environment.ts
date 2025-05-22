import type { Message } from "ai";
import type { DB } from "../db";
import type { Environment } from "../types";

export function getReadEnvironmentResult(
  environment: Environment,
  event: DB["task"]["event"],
) {
  const sections = [
    getCurrentTime(environment.currentTime),
    getWorkspaceFiles(environment.workspace, environment.info),
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

function getEvent(event: DB["task"]["event"]) {
  if (event) {
    return `# Event triggered this task\n${JSON.stringify(event, null, 2)}`;
  }
  return "";
}

function getGitStatus(gitStatus: string | undefined) {
  if (!gitStatus) return "";
  return `# GIT STATUS\nthis git status will keep latest changes in the repository.\n${gitStatus}`;
}

function getMessageToInject(messages: Message[]): Message | undefined {
  if (messages[messages.length - 1].role === "assistant") {
    // Last message is a function call result, inject it directly.
    return messages[messages.length - 1];
  }
  if (messages[messages.length - 2].role === "assistant") {
    // Last message is a user message, inject to the assistant message.
    return messages[messages.length - 2];
  }
}

export function injectReadEnvironment(
  requestedModelId: string,
  messages: Message[],
  environment: Environment | undefined,
  event: DB["task"]["event"],
) {
  if (environment === undefined) return messages;
  // There's only user message.
  if (messages.length === 1 && messages[0].role === "user") {
    // Prepend an empty assistant message.
    messages.unshift({
      id: `environmentMessage-assistant-${Date.now()}`,
      role: "assistant",
      content: "I'll use readEnvironment tool to check the environment.",
    });
    messages.unshift({
      id: `environmentMessage-user-${Date.now()}`,
      role: "user",
      content: "Please check the environment.",
    });
  }
  const messageToInject = getMessageToInject(messages);
  if (!messageToInject) return messages;

  const parts = [...(messageToInject.parts || [])];

  // create toolCallId with timestamp
  const isGemini = requestedModelId.includes("gemini");
  const toolCallId = `environmentToolCall-${Date.now()}`;
  const lastStepStartIndex = parts.findLastIndex(
    (part) => part.type === "step-start",
  );
  const lastToolInvocationIndex = parts.findLastIndex(
    (part) => part.type === "tool-invocation",
  );
  let step =
    parts.findLast((part) => part.type === "tool-invocation")?.toolInvocation
      .step || 0;
  if (lastStepStartIndex > lastToolInvocationIndex) {
    step += 1;
  }

  parts.push({
    type: "tool-invocation",
    toolInvocation: {
      toolName: "readEnvironment",
      step,
      state: "result",
      args: isGemini ? undefined : {},
      toolCallId,
      result: getReadEnvironmentResult(environment, event),
    },
  });

  messageToInject.parts = parts;
  return messages;
}

export function stripReadEnvironment(messages: Message[]) {
  const ret = [];
  for (const x of messages) {
    // Remove environment message
    if (x.id.startsWith("environmentMessage-")) {
      continue;
    }

    const m = {
      ...x,
    };

    if (m.parts) {
      m.parts = m.parts.filter((x) => {
        if (
          x.type === "tool-invocation" &&
          x.toolInvocation.toolName === "readEnvironment"
        )
          return false;
        return true;
      });
    }

    ret.push(m);
  }
  return ret;
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
