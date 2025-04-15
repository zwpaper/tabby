import Hashids from "hashids";
import type { NumberLike } from "hashids/util";

const hashids = new Hashids("ragdoll-taskid-salt");

/**
 * Encodes a numeric task ID to a hashed string
 */
export function encodeTaskId(id: NumberLike): string {
  return hashids.encode(id);
}

/**
 * Decodes a hashed string back to the original numeric task ID
 * @throws Error if the taskId is invalid
 */
export function decodeTaskId(taskId: string): number {
  const decoded = hashids.decode(taskId)[0];
  if (decoded === undefined) {
    throw new Error(`Invalid task id: ${taskId}`);
  }
  return Number(decoded);
}
