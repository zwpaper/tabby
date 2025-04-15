import { apiClient } from "@/lib/api";
import { useRouter } from "@/lib/router";
import { Spinner } from "@inkjs/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";
import { Box, Text, useInput } from "ink";
import moment from "moment";
import { Suspense, useState } from "react";

export default function TasksPage() {
  const { navigate } = useRouter();

  useInput((input) => {
    if (input === "c") {
      navigate("/chat");
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
              <Text>(Esc to go back)</Text>
            </Box>

            <TaskList onSelectTask={(task) => navigate(`/chat/${task.id}`)} />
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
  const [after, setAfter] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data, isLoading } = useSuspenseQuery({
    queryKey: ["tasks", after],
    queryFn: async () => {
      const res = await apiClient.api.tasks.$get({
        query: {
          after: after || undefined,
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
  };

  useInput((input, key) => {
    if (tasks.length === 0) return;

    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(prev + 1, tasks.length - 1));
    } else if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (key.return) {
      onSelectTask(tasks[selectedIndex]);
    } else if (key.tab || input === "n") {
      // Next page
      if (pagination.after && tasks.length >= pagination.limit) {
        setAfter(pagination.after);
        setSelectedIndex(0);
      }
    } else if ((key.shift && key.tab) || input === "p") {
      // Previous page (we would need to store previous pages)
      // This is a limitation as the API doesn't support backward pagination
      // For now, going back to the first page
      setAfter(null);
      setSelectedIndex(0);
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

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column" paddingX={1}>
        {tasks.map((task, index) => (
          <Box key={task.id} paddingX={1} paddingY={0}>
            <Text
              bold={selectedIndex === index}
              color={selectedIndex === index ? "white" : "gray"}
            >
              {String(index + 1).padStart(3, '0')}
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
          <Text dimColor={!after}>← (p) Prev</Text>
          <Text>
            Showing {tasks.length} of {pagination.totalCount} tasks
          </Text>
          <Text dimColor={!pagination.after || tasks.length < pagination.limit}>Next (n) →</Text>
        </Box>

        <Box paddingX={1} alignItems="center" justifyContent="center">
          <Text bold>↑/↓</Text>
          <Text> to navigate • </Text>
          <Text bold>Enter</Text>
          <Text> to view details • </Text>
          <Text bold>c</Text>
          <Text> to create new • </Text>
          <Text bold>Esc</Text>
          <Text> to go back</Text>
        </Box>
      </Box>
    </Box>
  );
}

// Helper function to format date
function formatDate(dateString: string): string {
  return moment(dateString).format("MM/DD/YYYY, hh:mm:ss a");
}
