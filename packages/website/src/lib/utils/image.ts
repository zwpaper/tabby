/**
 * Creates a unique filename for an image based on its type
 */
export function createImageFileName(type: string): string {
  const extension = type.split("/")[1] || "png";
  return `pasted-image-${Date.now()}.${extension}`;
}

/**
 * Generates a consistent ID for a file based on name and size
 * This is used for tracking uploads and preventing duplicates
 */
export function generateFileId(file: File): string {
  return `${file.name}-${file.size}`;
}

/**
 * Checks if a file is already in the files array to prevent duplicates
 */
export function isDuplicateFile(file: File, existingFiles: File[]): boolean {
  const fileId = generateFileId(file);
  return existingFiles.some(
    (existingFile) => generateFileId(existingFile) === fileId,
  );
}

/**
 * Processes image files, renaming clipboard images if needed
 */
export function processImageFiles(
  files: File[],
  fromClipboard = false,
): File[] {
  return files.map((file) => {
    // If the file is from clipboard, it might not have a proper name
    if (fromClipboard) {
      return new File([file], createImageFileName(file.type), {
        type: file.type,
      });
    }
    return file;
  });
}

/**
 * Validates images for size and count limits
 */
export function validateImages(
  existingFiles: File[],
  newFiles: File[],
  maxImages: number,
): {
  success: boolean;
  validatedImages: File[];
  error?: string;
} {
  // Check if adding new files would exceed the maximum
  if (existingFiles.length + newFiles.length > maxImages) {
    return {
      success: false,
      validatedImages: [],
      error: `You can only upload up to ${maxImages} images at a time.`,
    };
  }

  // Filter out any files that are too large (10MB limit)
  const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
  const validFiles = newFiles.filter((file) => file.size <= maxSizeInBytes);

  if (validFiles.length < newFiles.length) {
    return {
      success: false,
      validatedImages: [],
      error: "Some images exceed the 10MB size limit.",
    };
  }

  return {
    success: true,
    validatedImages: validFiles,
  };
}
