import { MaxFileSize } from "@/lib/constants";

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

  if (file.size > MaxFileSize) {
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
