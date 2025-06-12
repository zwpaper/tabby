import type { QueueBaseOptions } from "bullmq";
import IORedis from "ioredis";
import { parseRedisUrl } from "parse-redis-url-simple";

function createRedisConnection() {
  const config = parseRedisUrl(process.env.REDIS_URL)[0];

  // Create IORedis client with the URL
  const connection = new IORedis({
    ...config,
  });

  return connection;
}

// Export the Redis client instance
const connection = createRedisConnection();

export const queueConfig: QueueBaseOptions = {
  connection,
  prefix: "pochi",
};
