import type { QueueBaseOptions } from "bullmq";
import { BullMQOtel } from "bullmq-otel";
import IORedis from "ioredis";
import { parseRedisUrl } from "parse-redis-url-simple";

function createRedisConnection() {
  const config = parseRedisUrl(process.env.REDIS_URL)[0];

  // Create IORedis client with the URL
  const connection = new IORedis({
    ...config,
    family: 0,
    maxRetriesPerRequest: null,
  });

  return connection;
}

// Export the Redis client instance
const connection = createRedisConnection();
const otel = new BullMQOtel("background-jobs");

export const queueConfig: QueueBaseOptions = {
  connection,
  telemetry: otel,
  prefix: process.env.NODE_ENV === "production" ? "pochi" : "dev-pochi",
};
