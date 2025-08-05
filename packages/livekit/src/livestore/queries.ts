import { queryDb } from "@livestore/livestore";
import { tables } from "./schema";

export const messages$ = queryDb(() => tables.messages, { label: "messages" });

export const task$ = queryDb(() => tables.task.first(), { label: "task" });
