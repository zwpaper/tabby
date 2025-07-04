import { MobileWarningDialog } from "@/components/home/mobile-warning-dialog";
import { ImagePreviewList } from "@/components/image-preview-list";
import { useUploadImage } from "@/components/image-preview-list/use-upload-image";
import { PromptSuggestions } from "@/components/suggestions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiClient } from "@/lib/auth-client";
import { useSession } from "@/lib/auth-hooks";
import { useEnhancingPrompt } from "@/lib/use-enhancing-prompt";
import { cn } from "@/lib/utils";
import {
  createImageFileName,
  isDuplicateFile,
  processImageFiles,
  validateImages,
} from "@/lib/utils/image";
import { AuthCard } from "@daveyplate/better-auth-ui";
import { useRouter } from "@tanstack/react-router";
import type { Attachment } from "ai";
import {
  ArrowUpIcon,
  ImageIcon,
  Loader2Icon,
  SparklesIcon,
} from "lucide-react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { HomeBackgroundGradient } from "../home/constants";

export const MAX_IMAGES = 4; // Maximum number of images that can be uploaded at once

export function CreateTask({
  initialInput,
  className,
}: { initialInput?: string; className?: string }) {
  const { data: auth } = useSession();
  const isMobileDevice = useIsMobile();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const isRemote = true;

  const { enhancePrompt, isPending: isEnhancing } = useEnhancingPrompt();

  const [inputValue, setInputValue] = useState(() => {
    if (initialInput) {
      try {
        return decodeURIComponent(initialInput);
      } catch (e) {
        return initialInput;
      }
    }
    return "";
  });

  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [imageSelectionError, setImageSelectionError] = useState<
    Error | undefined
  >(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { navigate } = useRouter();

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (imageSelectionError) {
      const timer = setTimeout(() => {
        setImageSelectionError(undefined);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [imageSelectionError]);

  const handleRemoveImage = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const showImageError = (message: string) => {
    setImageSelectionError(new Error(message));
  };

  const validateAndAddImages = (
    newImages: File[],
    fromClipboard = false,
  ): { success: boolean; error?: string } => {
    const result = validateImages(
      files,
      processImageFiles(newImages, fromClipboard),
      MAX_IMAGES,
    );

    if (result.success) {
      setFiles((prevFiles) => [...prevFiles, ...result.validatedImages]);
      setImageSelectionError(undefined);
    }

    return {
      success: result.success,
      error: result.error,
    };
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const selectedFiles = Array.from(event.target.files);

      // Deduplication check for device uploads
      const nonDuplicateFiles = selectedFiles.filter(
        (file) => !isDuplicateFile(file, files),
      );

      // Show message if any duplicates were found
      if (nonDuplicateFiles.length < selectedFiles.length) {
        showImageError(
          `${selectedFiles.length - nonDuplicateFiles.length} duplicate image(s) were skipped.`,
        );
        // If all files were duplicates, stop here
        if (nonDuplicateFiles.length === 0) {
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          return;
        }
      }

      const result = validateAndAddImages(nonDuplicateFiles);

      if (!result.success) {
        showImageError(result.error || "Error adding images");
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const {
    uploadImages,
    uploadingFilesMap,
    isUploadingImages,
    stop: stopUpload,
    error: uploadImageError,
  } = useUploadImage({
    files,
  });

  const submitIsDisabled =
    isEnhancing ||
    isSubmitting ||
    isUploadingImages ||
    (inputValue.length < 8 && files.length === 0);

  const handleEnhance = async () => {
    if (isMobileDevice) {
      setShowMobileWarning(true);
      return;
    }
    if (!inputValue.trim()) return;
    if (auth === null) {
      setShowAuthDialog(true);
      return;
    }

    const enhanced = await enhancePrompt(inputValue);

    setInputValue(enhanced);
  };

  const doSubmit = async (input: string, name?: string) => {
    if (isMobileDevice) {
      setShowMobileWarning(true);
      return;
    }
    setSubmitError(null);
    if (auth === null) {
      setShowAuthDialog(true);
    } else {
      try {
        setIsSubmitting(true);
        let attachments: Attachment[] | undefined = undefined;

        if (files.length > 0) {
          try {
            attachments = await uploadImages();
          } catch (error) {
            throw new Error("Failed to upload images. Please try again.");
          }
        }

        const taskResponse = await apiClient.api.tasks.$post({
          json: {
            prompt: input,
            remote: isRemote,
            event: {
              type: "website:new-project",
              data: {
                requestId: crypto.randomUUID(),
                name,
                prompt: input,
                attachments,
                githubTemplateUrl:
                  "https://github.com/wsxiaoys/reimagined-octo-funicular",
              },
            },
          },
        });

        if (!taskResponse.ok) {
          const errorMessage = await taskResponse.text();
          throw new Error(errorMessage);
        }

        const { uid, url } = await taskResponse.json();

        await navigate({
          to: "/redirect-vscode",
          search: {
            uid,
            url,
          },
        });

        return;
      } catch (error) {
        setSubmitError(
          error instanceof Error ? error.message : "An unknown error occurred",
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (submitIsDisabled) return;
    doSubmit(inputValue);
  };

  const submitOnEnter = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePasteImage = (event: ClipboardEvent) => {
    if (isMobileDevice) {
      setShowMobileWarning(true);
      event.preventDefault();
      return true;
    }
    const images = Array.from(event.clipboardData?.items || [])
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => {
        const file = item.getAsFile();
        if (file) {
          return new File([file], createImageFileName(file.type), {
            type: file.type,
          });
        }
        return null;
      })
      .filter(Boolean) as File[];

    if (images.length > 0) {
      // Use fromClipboard=true to indicate these are clipboard images
      const result = validateAndAddImages(images, true);

      if (!result.success) {
        showImageError(result.error || "Error adding images");
        event.preventDefault();
        return true;
      }

      event.preventDefault();
      return true;
    }

    return false;
  };

  const handleStop = () => {
    if (isUploadingImages) {
      stopUpload();
    } else if (isSubmitting) {
      // The stop function wasn't defined
      // stop();
    }
  };

  const handleImageUploadClick = () => {
    if (isMobileDevice) {
      setShowMobileWarning(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleTextareaFocus = () => {
    if (isMobileDevice) {
      setShowMobileWarning(true);
    }
  };

  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col items-center p-4 pt-8 text-black dark:text-white",
        HomeBackgroundGradient,
        className,
      )}
    >
      <form
        className="w-full max-w-3xl rounded-lg border border-gray-300/50 bg-white/80 p-6 shadow-lg backdrop-blur-sm dark:border-gray-600/50 dark:bg-gray-900/80 dark:bg-input/30"
        onSubmit={handleSubmit}
        onClick={() => {
          textareaRef.current?.focus();
        }}
      >
        {files.length > 0 && (
          <ImagePreviewList
            files={files}
            onRemove={handleRemoveImage}
            uploadingFiles={uploadingFilesMap}
          />
        )}
        <Textarea
          ref={textareaRef}
          disabled={isSubmitting}
          onKeyDown={submitOnEnter}
          onFocus={handleTextareaFocus}
          onPaste={(e) => {
            handlePasteImage(e);
          }}
          placeholder="Ask Pochi to build..."
          className="!bg-transparent mb-4 min-h-10 w-full resize-none border-none text-black text-lg placeholder-gray-400 shadow-none focus-visible:ring-0 dark:text-white dark:placeholder-gray-500"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <div className="flex items-center justify-end">
          <div
            className="flex items-center space-x-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-gray-500 transition-colors hover:bg-gray-200/50 hover:text-black dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-white"
              onClick={handleEnhance}
              disabled={isEnhancing || !inputValue.trim()}
            >
              {isEnhancing ? (
                <Loader2Icon className="h-5 w-5 animate-spin" />
              ) : (
                <SparklesIcon className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-gray-500 transition-colors hover:bg-gray-200/50 hover:text-black dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-white"
              onClick={handleImageUploadClick}
            >
              <ImageIcon className="h-5 w-5" />
            </Button>
            <Button
              type="submit"
              disabled={submitIsDisabled}
              variant="default"
              size="icon"
              className="rounded-full transition-colors"
              onClick={(e) => {
                if (isSubmitting || isUploadingImages) {
                  e.preventDefault();
                  handleStop();
                  return;
                }
              }}
            >
              {isSubmitting || isUploadingImages ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <ArrowUpIcon />
              )}
            </Button>
          </div>
        </div>
        {/* Hidden file input for image uploads */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          multiple
          className="hidden"
        />
      </form>
      <PromptSuggestions
        hasSelectImage={!!files.length}
        handleSelectImage={handleImageUploadClick}
        handleSubmit={doSubmit}
        isSubmitting={isSubmitting}
      />
      <div className="mt-4 text-right font-medium text-destructive text-sm">
        {/* Display errors with priority: 1. imageSelectionError, 2. uploadImageError, 3. submitError */}
        {imageSelectionError?.message ||
          uploadImageError?.message ||
          submitError}
      </div>
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <AuthCard
            className="border-none shadow-none ring-none"
            callbackURL={
              inputValue
                ? `/?input=${encodeURIComponent(inputValue)}`
                : undefined
            }
          />
        </DialogContent>
      </Dialog>

      <MobileWarningDialog
        open={showMobileWarning}
        onOpenChange={setShowMobileWarning}
      />
    </div>
  );
}
