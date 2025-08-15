// import type { UIMessage } from "ai";

// export function inlineSubTasks(
//   uiMessages: UIMessage[],
//   subtasks: SubTask[],
// ): UIMessage[] {
//   return uiMessages.map((uiMessage) => {
//     const partsWithSubtasks = uiMessage.parts.map((part) => {
//       if (
//         part.type === "tool-invocation" &&
//         part.toolInvocation.state !== "partial-call" &&
//         part.toolInvocation.toolName === "newTask"
//       ) {
//         const subtask = subtasks.find(
//           (t) => t.uid === part.toolInvocation.args?._meta?.uid,
//         );
//         if (subtask) {
//           return {
//             ...part,
//             toolInvocation: {
//               ...part.toolInvocation,
//               args: {
//                 ...part.toolInvocation.args,
//                 _transient: {
//                   task: subtask,
//                 },
//               },
//             },
//           };
//         }
//       }
//       return part;
//     });
//     return {
//       ...uiMessage,
//       parts: partsWithSubtasks,
//     };
//   });
// }
