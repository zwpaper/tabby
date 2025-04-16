import { apiClient } from "@/lib/api";
import { useAppConfig } from "@/lib/app-config";
import { useRouter } from "@/lib/router";
import { Spinner } from "@inkjs/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { Box, Text, useInput } from "ink";
import moment from "moment";
import { Suspense, useCallback, useEffect, useState } from "react";

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

            <TaskList
              onSelectTask={(task) =>
                navigate({ route: "/chat", params: { id: task.id } })
              }
            />
          </Box>
        </Suspense>
      </Box>
    </Box>
  );
}

function TaskList({
  onSelectTask,
}: {
  onSelectTask: (
    task: InferResponseType<typeof apiClient.api.tasks.$get>["data"][0],
  ) => void;
}) {
  const [cursor, setCursor] = useState<{
    after?: string;
    before?: string;
  } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [paginationHistory, setPaginationHistory] = useState<
    Array<{ after?: string; before?: string }>
  >([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading, refetch } = useSuspenseQuery({
    queryKey: ["tasks", cursor?.after, cursor?.before],
    queryFn: async () => {
      const res = await apiClient.api.tasks.$get({
        query: {
          after: cursor?.after,
          before: cursor?.before,
          limit: "10",
        },
      });
      return await res.json();
    },
  });

  const tasks = data?.data || [];
  const pagination = data?.pagination || {
    totalCount: 0,
    limit: 10,
    after: null,
    before: null,
  };

  const deleteTask = useCallback(async () => {
    if (tasks.length === 0 || !showDeleteConfirm || isDeleting) return;

    setIsDeleting(true);
    const taskToDelete = tasks[selectedIndex];
    try {
      const res = await apiClient.api.tasks[":id"].$delete({
        param: { id: taskToDelete.id },
      });

      if (res.ok) {
        setShowDeleteConfirm(false);
        // Refetch tasks after deletion
        await refetch();
        // Adjust selected index if needed
        if (selectedIndex >= tasks.length - 1 && selectedIndex > 0) {
          setSelectedIndex(selectedIndex - 1);
        }
      } else {
        throw new Error(`Failed to delete task: ${res.statusText}`);
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    } finally {
      setIsDeleting(false);
    }
  }, [tasks, selectedIndex, showDeleteConfirm, isDeleting, refetch]);

  useEffect(() => {
    if (data && cursor !== null) {
      const cursorKey = JSON.stringify(cursor);
      if (
        (currentHistoryIndex === paginationHistory.length - 1 ||
          currentHistoryIndex === -1) &&
        (paginationHistory.length === 0 ||
          JSON.stringify(paginationHistory[currentHistoryIndex] || {}) !==
            cursorKey)
      ) {
        setPaginationHistory((prev) => {
          const newHistory = [
            ...prev.slice(0, currentHistoryIndex + 1),
            cursor,
          ];
          return newHistory;
        });
        setCurrentHistoryIndex((prev) => prev + 1);
      }
    }
  }, [data, cursor, currentHistoryIndex, paginationHistory]);

  useEffect(() => {
    if (paginationHistory.length === 0 && data) {
      setPaginationHistory([{}]);
      setCurrentHistoryIndex(0);
    }
  }, [data, paginationHistory.length]);

  useInput((input, key) => {
    if (isDeleting) return;

    if (showDeleteConfirm) {
      if (input === "y" || key.return) {
        deleteTask();
      } else if (input === "n" || key.escape) {
        setShowDeleteConfirm(false);
      }
      return;
    }

    if (tasks.length === 0) return;

    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(prev + 1, tasks.length - 1));
    } else if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (key.return) {
      onSelectTask(tasks[selectedIndex]);
    } else if (key.tab || input === "n") {
      if (pagination.after) {
        setCursor({ after: pagination.after });
        setSelectedIndex(0);
      }
    } else if ((key.shift && key.tab) || input === "p") {
      if (pagination.before) {
        setCursor({ before: pagination.before });
        setSelectedIndex(0);
      } else if (currentHistoryIndex > 0) {
        setCurrentHistoryIndex((prev) => prev - 1);
        setCursor(paginationHistory[currentHistoryIndex - 1] || null);
        setSelectedIndex(0);
      }
    } else if (input === "d") {
      setShowDeleteConfirm(true);
    }
  });

  if (isLoading) {
    return <Spinner />;
  }

  if (tasks.length === 0) {
    return (
      <Box flexDirection="column" alignItems="center" gap={1}>
        <Text dimColor>No tasks found</Text>
        <Text>Press (c) to create a new task</Text>
      </Box>
    );
  }

  if (showDeleteConfirm) {
    return (
      <Box
        flexDirection="column"
        gap={1}
        borderStyle="round"
        borderColor="yellow"
        padding={1}
      >
        <Text bold color="yellow">
          Delete Confirmation
        </Text>
        {isDeleting ? (
          <Box marginY={1}>
            <Spinner label="Deleting task..." />
          </Box>
        ) : (
          <>
            <Text>Are you sure you want to delete this task?</Text>
            <Text color="gray">{tasks[selectedIndex].abstract}</Text>
            <Box gap={2} marginTop={1}>
              <Text bold>(y)</Text>
              <Text>Yes, delete</Text>
              <Text bold>(n)</Text>
              <Text>Cancel</Text>
            </Box>
          </>
        )}
      </Box>
    );
  }

  const canGoNext = !!pagination.after;
  const canGoPrevious = !!pagination.before || currentHistoryIndex > 0;

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column" paddingX={1}>
        {tasks.map((task, index) => (
          <Box key={task.id} paddingX={1} paddingY={0}>
            <Text
              bold={selectedIndex === index}
              color={selectedIndex === index ? "white" : "gray"}
            >
              {task.id}
            </Text>
            <Text> | </Text>
            <Text color={selectedIndex === index ? "white" : "gray"}>
              {formatDate(task.createdAt)}
            </Text>
            <Text> | </Text>
            <Text color={selectedIndex === index ? "white" : "gray"}>
              {task.abstract}
            </Text>
          </Box>
        ))}
      </Box>

      <Box flexDirection="column">
        <Box justifyContent="space-between" paddingX={1}>
          <Text dimColor={!canGoPrevious}>← (p) Prev</Text>
          <Text>
            Showing {tasks.length} of {pagination.totalCount} tasks
          </Text>
          <Text dimColor={!canGoNext}>Next (n) →</Text>
        </Box>

        <Box paddingX={1} alignItems="center" justifyContent="center">
          <Text bold>↑/↓</Text>
          <Text> to navigate • </Text>
          <Text bold>Enter</Text>
          <Text> to view details • </Text>
          <Text bold>c</Text>
          <Text> to create new • </Text>
          <Text bold>d</Text>
          <Text> to delete</Text>
        </Box>
      </Box>
    </Box>
  );
}

// Helper function to format date
function formatDate(dateString: string): string {
  return moment(dateString).format("MM/DD/YYYY, hh:mm:ss a");
}
