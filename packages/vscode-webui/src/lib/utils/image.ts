import { MAX_FILE_SIZE } from "@/lib/constants";

/**
 * Validates if the provided file is a valid image within size constraints
 */
export function validateImage(file: File): { valid: boolean; error?: string } {
  if (!file.type.startsWith("image/")) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Only images are allowed.`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 10MB.`,
    };
  }

  return { valid: true };
}

/**
 * Creates a consistent filename for uploaded images
 */
export function createImageFileName(type: string): string {
  return `pasted-image-${Date.now()}.${type.split("/")[1]}`;
}

/**
 * Generates a consistent ID for a file based on name and size
 * This is used for tracking uploads and preventing duplicates
 */
export function generateFileId(file: File): string {
  return `${file.name}-${file.size}`;
}

/**
 * Checks if a file already exists in the current file list based on its ID
 */
export function isDuplicateFile(file: File, existingFiles: File[]): boolean {
  const fileId = generateFileId(file);
  return existingFiles.some(
    (existingFile) => generateFileId(existingFile) === fileId,
  );
}

/**
 * Processes files to ensure they're properly named images
 * For clipboard images, generates consistent filenames
 * For device uploads, preserves original filenames
 */
export function processImageFiles(
  imageFiles: File[],
  fromClipboard = false,
): File[] {
  if (!fromClipboard) {
    // Preserve original filenames for device uploads
    return imageFiles;
  }

  // Generate consistent filenames only for clipboard images
  return imageFiles.map((file) => {
    return new File([file], createImageFileName(file.type), {
      type: file.type,
    });
  });
}

/**
 * Validates and processes an array of images
 * Returns success/failure and an optional error message
 */
export function validateImages(
  files: File[],
  newImages: File[],
  maxImages: number,
): { success: boolean; error?: string; validatedImages: File[] } {
  // Check if adding these images would exceed the maximum
  if (files.length + newImages.length > maxImages) {
    return {
      success: false,
      error: `Cannot attach more than ${maxImages} images.`,
      validatedImages: [],
    };
  }

  // Validate each image
  const validatedImages: File[] = [];

  for (const image of newImages) {
    const validation = validateImage(image);
    if (validation.valid) {
      validatedImages.push(image);
    } else {
      return {
        success: false,
        error: validation.error || "Invalid image",
        validatedImages: [],
      };
    }
  }

  return {
    success: true,
    validatedImages,
  };
}
