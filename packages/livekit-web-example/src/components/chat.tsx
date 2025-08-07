import { getTaskId } from "../lib/workspace-id";
import { ChatView } from "./chat-view";

export default function Page() {
  const taskId = getTaskId();
  if (!taskId) return;

  return (
    <div className="chat-layout">
      <ChatView taskId={taskId} />
    </div>
  );
}
