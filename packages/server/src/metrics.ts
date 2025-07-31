import { metrics as otelMetrics } from "@opentelemetry/api";

const meter = otelMetrics.getMeter("ragdoll-server");

const slackCommandsTotal = meter.createCounter("slack_commands_total", {
  description: "Total number of slack commands processed",
});

const slackTasksCreated = meter.createCounter("slack_tasks_created_total", {
  description: "Total number of tasks created via Slack",
});

const slackFollowupActions = meter.createCounter(
  "slack_followup_actions_total",
  {
    description: "Total number of followup actions processed",
  },
);

const tasksTotal = meter.createCounter("tasks_total", {
  description: "Total number of tasks",
});

const taskDuration = meter.createHistogram("task_duration_seconds", {
  description: "Task completion duration in seconds",
  unit: "s",
});

const activeConnections = meter.createUpDownCounter("active_connections", {
  description: "Number of active connections",
});

export const metrics = {
  counter: {
    slackCommandsTotal,
    slackTasksCreated,
    slackFollowupActions,
    tasksTotal,
  },
  histogram: {
    taskDuration,
  },
  gauge: {
    activeConnections,
  },
};
