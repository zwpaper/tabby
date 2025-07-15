import type { TaskData } from "../types";

interface TaskListProps {
  tasks: TaskData[];
  selectedTask: TaskData | null;
  onSelectTask: (task: TaskData) => void;
}

export function TaskList({ tasks, selectedTask, onSelectTask }: TaskListProps) {
  // Sort tasks to show PENDING tasks first
  const sortedTasks = [...tasks].sort((a, b) => {
    const aIsPending = !a.verified && !a.excluded && a.verified === undefined;
    const bIsPending = !b.verified && !b.excluded && b.verified === undefined;

    if (aIsPending && !bIsPending) return -1;
    if (!aIsPending && bIsPending) return 1;
    return 0; // Keep original order for tasks with same status
  });

  return (
    <div className="w-1/3 overflow-y-auto border-gray-200 border-r bg-gray-50 p-4">
      <h2 className="mb-4 font-semibold text-gray-800 text-lg">Tasks</h2>
      <ul className="space-y-2">
        {sortedTasks.map((task) => (
          <li
            key={task.uid}
            onClick={() => onSelectTask(task)}
            className={`flex cursor-pointer items-center justify-between rounded-md p-3 transition-colors ${selectedTask?.uid === task.uid ? "bg-blue-100 text-blue-800" : "hover:bg-gray-200"}`}
          >
            <span className="mr-4 flex max-w-120 gap-2 truncate">
              <b>[{task.uid}]</b>
              {getTaskTitle(task)}
            </span>
            <div className="flex items-center gap-2">
              {task.excluded && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-red-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <title>Excluded</title>
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {task.verified ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-green-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <title>Verified</title>
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : !task.excluded && task.verified === undefined ? (
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 font-medium text-xs text-yellow-800">
                  PENDING
                </span>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <title>Not Verified</title>
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getTaskTitle(task: TaskData) {
  const user = task.messages[1];
  if (typeof user.content === "string") {
    return user.content;
  }
  return user.content[1].text;
}
