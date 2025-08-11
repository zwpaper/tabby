if (import.meta.env.PROD) {
  typeof window !== "undefined" &&
    // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
    // biome-ignore lint/suspicious/noGlobalAssign: <explanation>
    (Blob = ((BaseBlob) =>
      class Blob extends BaseBlob {
        constructor(blobParts, options) {
          let parts = blobParts;
          if (blobParts[0] === "URL.revokeObjectURL(import.meta.url);") {
            parts = [
              blobParts[0],
              window.__workerAssetsPathScript,
              blobParts.slice(1),
            ];
          }
          super(parts, options);
        }
      })(Blob));
}
