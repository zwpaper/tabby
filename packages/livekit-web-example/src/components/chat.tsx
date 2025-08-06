import { useStore } from "@livestore/react";
import { LiveChatKitProvider, useLiveChatKit } from "@ragdoll/livekit/react";
import { ChatView } from "./chat-view";

function TaskInfo() {
  const { store } = useStore();
  const { useTask } = useLiveChatKit();
  const task = useTask();

  return (
    <div className="sidebar">
      <h3>Task {store.storeId}</h3>
      <p>
        <strong>Status:</strong> {task.status}
      </p>
      {task.totalTokens && (
        <p>
          <strong>Total Tokens:</strong> {task.totalTokens}
        </p>
      )}
      {task.error && (
        <div>
          <strong>Error:</strong> {task.error.message}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  const { store } = useStore();
  return (
    <LiveChatKitProvider taskId="default" store={store}>
      <div className="chat-layout">
        <TaskInfo />
        <ChatView />
      </div>
    </LiveChatKitProvider>
  );
}
