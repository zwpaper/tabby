export function formatTaskId(id: number) {
  return `TASK-${id.toString().padStart(3, "0")}`;
}
