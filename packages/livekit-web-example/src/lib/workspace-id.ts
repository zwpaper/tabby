export const getTaskId = () => {
  if (typeof window === "undefined") return "unused";

  const searchParams = new URLSearchParams(window.location.search);
  const storeId = searchParams.get("taskId");
  if (storeId !== null) return storeId;

  const newAppId = crypto.randomUUID();
  searchParams.set("taskId", newAppId);

  window.location.search = searchParams.toString();
};
