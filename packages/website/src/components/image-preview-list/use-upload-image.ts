import { generateFileId } from "@/lib/utils/image";
import type { Attachment } from "ai";
import { useEffect, useRef, useState } from "react";
interface UseUploadImageOptions {
  token: string;
  files: File[] | undefined;
}

export function useUploadImage({ token, files }: UseUploadImageOptions) {
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadingFilesMap, setUploadingFilesMap] = useState<
    Record<string, boolean>
  >({});
  const [uploadResults, setUploadResults] = useState<
    Record<string, "success" | "error">
  >({});
  const [error, setError] = useState<Error | undefined>(undefined);
  const uploadAbortController = useRef(new AbortController());

  const uploadImages = async (): Promise<Attachment[] | undefined> => {
    // Clear error
    setError(undefined);

    if (!files?.length) {
      return [];
    }

    // Reset upload state
    setIsUploadingImages(true);

    // Create tracking state for each file
    const newUploadingFiles = files.reduce(
      (acc, file) => {
        const fileId = generateFileId(file);
        acc[fileId] = true;
        return acc;
      },
      {} as Record<string, boolean>,
    );

    setUploadingFilesMap(newUploadingFiles);

    // Create a new AbortController
    uploadAbortController.current = new AbortController();
    const { signal } = uploadAbortController.current;

    try {
      const uploadedImages: Attachment[] = await Promise.all(
        files.map(async (file) => {
          const fileId = generateFileId(file);
          try {
            const formData = new FormData();
            formData.append("image", file);
            const response = await fetch("/api/upload", {
              method: "POST",
              body: formData,
              signal,
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!response.ok) {
              setUploadResults((prev) => ({ ...prev, [fileId]: "error" }));
              throw new Error(`Upload failed: ${response.statusText}`);
            }

            setUploadResults((prev) => ({ ...prev, [fileId]: "success" }));
            const data = await response.json();
            const result: Attachment = {
              name: file.name || "unnamed-image",
              contentType: file.type,
              url: data.image,
            };
            return result;
          } catch (error) {
            if (signal.aborted) {
              throw new DOMException("Aborted", "AbortError");
            }
            throw error;
          }
        }),
      );

      return uploadedImages;
    } catch (error) {
      if (error instanceof DOMException) {
        setError(new Error("Upload aborted by user."));
      } else {
        setError(new Error("Failed to upload images. Please try again."));
      }
      throw error;
    } finally {
      setIsUploadingImages(false);
      setUploadingFilesMap({});
    }
  };

  const stop = () => {
    uploadAbortController.current.abort();
    setIsUploadingImages(false);
    setUploadingFilesMap({});
  };

  useEffect(() => {
    if (!files?.length) {
      setError(undefined);
    }
  }, [files?.length]);

  return {
    uploadImages,
    isUploadingImages,
    uploadingFilesMap,
    uploadResults,
    stop,
    error: error,
    setError,
  };
}
