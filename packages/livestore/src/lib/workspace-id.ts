export const getWorkspaceId = () => {
  if (typeof window === "undefined") return "unused";

  const searchParams = new URLSearchParams(window.location.search);
  const storeId = searchParams.get("workspaceId");
  if (storeId !== null) return storeId;

  const newAppId = crypto.randomUUID();
  searchParams.set("workspaceId", newAppId);

  window.location.search = searchParams.toString();
};
