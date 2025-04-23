import { apiClient } from "@/lib/api";
import { useAppConfig } from "@/lib/app-config";
import { useRouter } from "@/lib/router";
import { Spinner } from "@inkjs/ui";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { Box, Text, useFocus, useInput } from "ink";
import moment from "moment";
import { Suspense, useCallback, useEffect, useState } from "react";

// Define types based on the API response
type TasksResponse = InferResponseType<typeof apiClient.api.tasks.$get>;
type Task = TasksResponse["data"][number];
// Extract pagination type from the response
type PaginationInfo = TasksResponse["pagination"];

const TASK_LIMIT = 10; // Define page size

// Helper function to format date
function formatDate(dateString: string): string {
  return moment(dateString).format("MM/DD/YYYY, hh:mm:ss a");
}

// Helper function to get status display
function getStatusDisplay(status: Task["status"]): string {
  let statusDisplay: string;

  switch (status) {
    case "completed":
      statusDisplay = "X";
      break;
    case "pending-input":
      statusDisplay = "P";
      break;
    case "failed":
      statusDisplay = "E";
      break;
    case "pending-tool":
    case "streaming":
      statusDisplay = "R";
      break;
    default:
      statusDisplay = "?"; // Add a default case
      break;
  }
  return statusDisplay;
}

export default function TasksPage() {
  const appConfig = useAppConfig();
  const { navigate, initialPromptSent } = useRouter();

  const [isCreating, setIsCreating] = useState(false);
  const createTask = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const res = await apiClient.api.tasks.$post();
      if (res.ok) {
        const { id } = await res.json();
        navigate({
          route: "/chat",
          params: {
            id,
          },
        });
      } else {
        throw new Error(`Failed to create task ${res.statusText}`);
      }
    } finally {
      setIsCreating(false);
    }
  }, [navigate, isCreating]);

  useEffect(() => {
    if (!initialPromptSent.current && appConfig.prompt) {
      createTask();
    }
  }, [appConfig, createTask, initialPromptSent.current]);

  useInput((input) => {
    if (input === "c") {
      createTask();
    }
  });

  return (
    <Box width="100%" justifyContent="center" alignItems="center">
      <Box width="75%" justifyContent="center" alignItems="center">
        <Suspense fallback={<Spinner />}>
          <Box
            width="100%"
            borderStyle="round"
            flexDirection="column"
            paddingX={1}
            gap={1}
          >
            <Box gap={1}>
              <Text bold>Tasks</Text>
              {isCreating && (
                <Box marginLeft={2}>
                  <Spinner label="Creating task..." />
                </Box>
              )}
            </Box>

            <TaskList />
          </Box>
        </Suspense>
      </Box>
    </Box>
  );
}

function TaskList() {
  const { navigate } = useRouter();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1); // Use currentPage state
  // Add confirmation state for deletion
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Use useSuspenseQuery for suspense integration
  const { data, isFetching } = useSuspenseQuery<TasksResponse, Error>({
    // Update queryKey to use currentPage
    queryKey: ["tasks", currentPage, TASK_LIMIT],
    queryFn: async () => {
      const res = await apiClient.api.tasks.$get({
        query: {
          limit: String(TASK_LIMIT),
          page: String(currentPage), // Send page parameter
        },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch tasks");
      }
      return await res.json();
    },
  });

  // data is guaranteed to be defined here due to useSuspenseQuery
  const tasks = data.data;
  const pagination: PaginationInfo | undefined = data.pagination; // Use extracted type

  const [selectedIndex, setSelectedIndex] = useState(0);
  const { isFocused } = useFocus({ autoFocus: true }); // Auto focus the list

  // Reset selected index when tasks change (e.g., page change, deletion)
  useEffect(() => {
    if (tasks) {
      setSelectedIndex(0);
    }
  }, [tasks]);

  const handleNextPage = useCallback(() => {
    // Use totalPages from pagination info
    if (pagination && currentPage < pagination.totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [pagination, currentPage]);

  const handlePreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [currentPage]);

  const handleDelete = useCallback(
    async (taskId: number) => {
      try {
        const res = await apiClient.api.tasks[":id"].$delete({
          param: { id: taskId.toString() },
        });
        if (res.ok) {
          // Invalidate tasks query for the current page
          queryClient.invalidateQueries({
            queryKey: ["tasks", currentPage, TASK_LIMIT],
          });
          // Optionally, check if the deleted item was the last on the page
          // and navigate to the previous page if necessary and possible.
          if (tasks.length === 1 && currentPage > 1) {
            setCurrentPage((prev) => prev - 1);
          } else {
            // Reset index safely after invalidation/refetch potentially changes list length
            setSelectedIndex((prev) =>
              Math.max(0, Math.min(prev, tasks.length - 2)),
            ); // Adjust index if needed
          }
        } else {
          console.error("Failed to delete task:", await res.text());
        }
      } catch (error) {
        console.error("Error deleting task:", error);
      }
    },
    [queryClient, currentPage, tasks.length], // Add tasks.length dependency
  );

  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        // Ensure index stays within bounds after potential deletion/refetch
        setSelectedIndex((prev) => Math.min(tasks.length - 1, prev + 1));
      } else if (key.return) {
        const selectedTask = tasks[selectedIndex];
        if (selectedTask) {
          navigate({ route: "/chat", params: { id: selectedTask.id } });
        }
      } else if (input === "n" && confirmingDelete) {
        // Handle canceling deletion first, before next page
        setConfirmingDelete(false);
        setTaskToDelete(null);
      } else if (input === "n" && !confirmingDelete) {
        // Only go to next page if not confirming a deletion
        handleNextPage();
      } else if (input === "p") {
        handlePreviousPage();
      } else if (input === "d") {
        // Check if tasks array is not empty before accessing selectedIndex
        if (
          tasks.length > 0 &&
          selectedIndex >= 0 &&
          selectedIndex < tasks.length
        ) {
          const selectedTask = tasks[selectedIndex];
          if (selectedTask) {
            setConfirmingDelete(true);
            setTaskToDelete(selectedTask);
          }
        }
      } else if (input === "s") {
        navigate("/settings");
      } else if (input === "y" && confirmingDelete && taskToDelete) {
        handleDelete(taskToDelete.id);
        setConfirmingDelete(false);
        setTaskToDelete(null);
      }
    },
    { isActive: isFocused },
  );

  // Adjust empty state check for page-based pagination
  if (!tasks.length && currentPage === 1 && !isFetching) {
    return <Text>No tasks found. Press 'c' to create one.</Text>;
  }

  const canGoPrevious = currentPage > 1;
  const canGoNext = pagination ? currentPage < pagination.totalPages : false;

  return (
    <Box flexDirection="column" width="100%">
      <Box flexDirection="column" flexGrow={1}>
        {/* Add explicit types for map parameters */}
        {tasks.map((task: Task, index: number) => (
          <Box
            key={task.id}
            paddingX={1}
            justifyContent="space-between"
            width="100%"
          >
            <Box gap={2}>
              <Text
                color={
                  index === selectedIndex && isFocused ? "blue" : undefined
                }
              >
                {getStatusDisplay(task.status)}
              </Text>
              <Text
                color={
                  index === selectedIndex && isFocused ? "blue" : undefined
                }
              >
                {task.id}
              </Text>
              <Text
                color={
                  index === selectedIndex && isFocused ? "blue" : undefined
                }
              >
                {task.title.slice(0, 64)}
              </Text>
            </Box>
            <Text dimColor>Updated: {formatDate(task.updatedAt)}</Text>
          </Box>
        ))}
      </Box>

      {/* Footer with pagination and help text */}
      <Box flexDirection="column" marginTop={1}>
        {confirmingDelete && taskToDelete && (
          <Box
            borderStyle="round"
            borderColor="yellow"
            padding={1}
            flexDirection="column"
            alignItems="center"
            marginBottom={1}
          >
            <Text color="yellow" bold>
              Confirm Delete
            </Text>
            <Text>
              Are you sure you want to delete task: {taskToDelete.id}?
            </Text>
            <Box marginTop={1} gap={2}>
              <Text bold>
                Press <Text color="green">y</Text> to confirm or{" "}
                <Text color="red">n</Text> to cancel
              </Text>
            </Box>
          </Box>
        )}
        <Box justifyContent="space-between" paddingX={1}>
          <Text dimColor={!canGoPrevious}>← (p) Previous</Text>
          {/* Display current page and total pages */}
          <Text>
            {pagination
              ? `Page ${currentPage} of ${pagination.totalPages} (Total: ${pagination.totalCount})`
              : ""}
          </Text>
          <Text dimColor={!canGoNext}>Next (n) →</Text>
        </Box>

        <Box paddingX={1} alignItems="center" justifyContent="center" gap={1}>
          <Text>
            <Text bold>↑/↓</Text> Navigate
          </Text>
          <Text>•</Text>
          <Text>
            <Text bold>Enter</Text> View
          </Text>
          <Text>•</Text>
          <Text>
            <Text bold>c</Text> Create
          </Text>
          <Text>•</Text>
          <Text>
            <Text bold>d</Text> Delete
          </Text>
          <Text>•</Text>
          <Text>
            <Text bold>s</Text> Settings
          </Text>
          {confirmingDelete && (
            <>
              <Text>•</Text>
              <Text>
                <Text bold>y</Text> Confirm Delete
              </Text>
              <Text>•</Text>
              <Text>
                <Text bold>n</Text> Cancel Delete
              </Text>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
