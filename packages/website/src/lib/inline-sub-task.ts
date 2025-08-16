import type { InferToolInput, UIMessage } from "@ai-v5-sdk/ai";
import type { ClientToolsType, SubTask } from "@getpochi/tools";

export function inlineSubTasks(
  uiMessages: UIMessage[],
  subtasks: SubTask[],
): UIMessage[] {
  return uiMessages.map((uiMessage) => {
    const partsWithSubtasks = uiMessage.parts.map((part) => {
      if (part.type === "tool-newTask" && part.state !== "input-streaming") {
        const input = part.input as InferToolInput<ClientToolsType["newTask"]>;
        const subtask = subtasks.find(
          (t) => t.clientTaskId === input._meta?.uid,
        );
        if (subtask) {
          return {
            ...part,
            input: {
              ...input,
              _transient: {
                task: subtask,
              },
            },
          };
        }
      }
      return part;
    });
    return {
      ...uiMessage,
      parts: partsWithSubtasks,
    };
  });
}
