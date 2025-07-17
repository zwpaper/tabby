// Modified from: https://github.com/TabbyML/tabby/blob/493cef3b3229548175de430dbc7f7e4a092ca507/clients/tabby-agent/src/codeCompletion/latencyTracker.ts

export type LatencyStatistics = {
  values: number[];
  metrics: {
    total: number;
    timeouts: number;
    responses: number;
    averageResponseTime: number;
  };
};

class LastN {
  private readonly values: number[] = [];

  constructor(private readonly maxSize: number) {}

  add(value: number): void {
    this.values.push(value);
    if (this.values.length > this.maxSize) {
      this.values.shift();
    }
  }

  getValues(): number[] {
    return this.values;
  }
}

export class LatencyTracker {
  private windowSize: number;
  private latencies: LastN;

  constructor(options?: { windowSize: number }) {
    this.windowSize = options?.windowSize ?? 10;
    this.latencies = new LastN(this.windowSize);
  }

  // add a latency entry, add NaN for timeouts
  add(entry: number): void {
    this.latencies.add(entry);
  }

  reset(): void {
    this.latencies = new LastN(this.windowSize);
  }

  calculateLatencyStatistics(): LatencyStatistics {
    const latencies = this.latencies.getValues();
    const timeouts = latencies.filter((latency) => Number.isNaN(latency));
    const responses = latencies.filter((latency) => !Number.isNaN(latency));
    const averageResponseTime =
      responses.reduce((acc, latency) => acc + latency, 0) / responses.length;
    return {
      values: latencies,
      metrics: {
        total: latencies.length,
        timeouts: timeouts.length,
        responses: responses.length,
        averageResponseTime,
      },
    };
  }
}

export function analyzeMetrics(
  latencyStatistics: LatencyStatistics,
): "healthy" | "highTimeoutRate" | "slowResponseTime" | null {
  const rules = {
    // Mark status as healthy if the latency is less than the threshold for each latest windowSize requests.
    healthy: { windowSize: 1, latency: 3000 },
    // If there is at least {count} requests, and the average response time is higher than the {latency}, show warning
    slowResponseTime: { latency: 5000, count: 1 },
    // If there is at least {count} timeouts, and the timeout rate is higher than the {rate}, show warning
    highTimeoutRate: { rate: 0.5, count: 1 },
  };

  const {
    values: latencies,
    metrics: { total, timeouts, responses, averageResponseTime },
  } = latencyStatistics;

  if (
    latencies
      .slice(-Math.min(latencies.length, rules.healthy.windowSize))
      .every((latency) => latency < rules.healthy.latency)
  ) {
    return "healthy";
  }
  if (
    timeouts / total > rules.highTimeoutRate.rate &&
    timeouts >= rules.highTimeoutRate.count
  ) {
    return "highTimeoutRate";
  }
  if (
    averageResponseTime > rules.slowResponseTime.latency &&
    responses >= rules.slowResponseTime.count
  ) {
    return "slowResponseTime";
  }
  return null;
}
