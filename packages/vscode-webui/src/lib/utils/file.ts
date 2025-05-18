export const getFileName = (filePath: string) => {
  const parts = filePath.split("/");
  return parts[parts.length - 1];
};

export const isFolder = (filePath: string) => {
  const parts = filePath.split("/");
  return !parts[parts.length - 1].includes(".");
};

/**
 * Adds a zero-width space (U+200B) after each slash and period
 * to improve line breaking in URIs.
 */
export const addLineBreak = (text: string) => {
  return text.replace(/\/|\./g, (match) => `${match}\u200B`);
};
