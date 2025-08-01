import type {
  Counter,
  Histogram,
  MetricOptions,
  UpDownCounter,
} from "@opentelemetry/api";
import { metrics as otelMetrics } from "@opentelemetry/api";

const METRICS_PREFIX = process.env.OTEL_SERVICE_NAME || "ragdoll";

const meter = otelMetrics.getMeter("ragdoll-server");

function createCounter(name: string, options?: MetricOptions): Counter {
  return meter.createCounter(`${METRICS_PREFIX}_${name}`, options);
}

function createHistogram(name: string, options?: MetricOptions): Histogram {
  return meter.createHistogram(`${METRICS_PREFIX}_${name}`, options);
}

function createUpDownCounter(
  name: string,
  options?: MetricOptions,
): UpDownCounter {
  return meter.createUpDownCounter(`${METRICS_PREFIX}_${name}`, options);
}

const slackCommandsTotal = createCounter("slack_commands_total", {
  description: "Total number of slack commands processed",
});

const slackTasksCreated = createCounter("slack_tasks_created_total", {
  description: "Total number of tasks created via Slack",
});

const slackFollowupActions = createCounter("slack_followup_actions_total", {
  description: "Total number of followup actions processed",
});

const tasksTotal = createCounter("tasks_total", {
  description: "Total number of tasks",
});

const taskDuration = createHistogram("task_duration_seconds", {
  description: "Task completion duration in seconds",
  unit: "s",
});

const activeConnections = createUpDownCounter("active_connections", {
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
