export const getFileName = (filePath: string) => {
  const parts = filePath.split("/");
  return parts[parts.length - 1];
};

export const isFolder = (filePath: string) => {
  const parts = filePath.split("/");
  return !parts[parts.length - 1].includes(".");
};
