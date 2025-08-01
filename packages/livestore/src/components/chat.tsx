import { useStore } from "@livestore/react";
import { useCallback, useEffect } from "react";
import { tasks$, uiState$ } from "../livestore/queries";
import { events } from "../livestore/schema";
import { ChatView } from "./chat-view";

export default function Chat() {
  const { store } = useStore();
  const tasks = store.useQuery(tasks$);
  const { taskId } = store.useQuery(uiState$);

  const setActiveTaskId = useCallback(
    (taskId: string) => {
      store.commit(events.uiStateSet({ taskId }));
    },
    [store.commit],
  );

  const createNewTask = useCallback(() => {
    const newTaskId = crypto.randomUUID();
    store.commit(
      events.taskCreated({
        id: newTaskId,
      }),
    );
    setActiveTaskId(newTaskId);
  }, [setActiveTaskId, store]);

  useEffect(() => {
    if (tasks[0] && !taskId) {
      setActiveTaskId(tasks[0].id);
    }

    if (tasks.length === 0) {
      createNewTask();
    }
  }, [taskId, tasks, setActiveTaskId, createNewTask]);

  return (
    <div className="chat-layout">
      <div className="sidebar">
        <button
          type="button"
          className="new-task-button"
          onClick={createNewTask}
        >
          New Task
        </button>
        <div className="task-list">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`task-item ${task.id === taskId ? "active" : ""}`}
              onClick={() => setActiveTaskId(task.id)}
            >
              {task.title || `Task ${task.id.slice(0, 8)}`}
            </div>
          ))}
        </div>
      </div>
      {taskId && <ChatView key={taskId} />}
    </div>
  );
}
