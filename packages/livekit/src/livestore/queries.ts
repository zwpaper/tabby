import { queryDb } from "@livestore/livestore";
import { tables } from "./schema";

export const makeTaskQuery = (taskId: string) =>
  queryDb(() => tables.tasks.where("id", "=", taskId).first(), {
    label: "task",
  });

export const makeMessagesQuery = (taskId: string) =>
  queryDb(() => tables.messages.where("taskId", "=", taskId), {
    label: "messages",
  });
