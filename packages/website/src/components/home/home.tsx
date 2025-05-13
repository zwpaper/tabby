import { ImagePreviewList } from "@/components/image-preview-list";
import { useUploadImage } from "@/components/image-preview-list/use-upload-image";
import { PromptSuggestions } from "@/components/suggestions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { UserButton } from "@/components/user-button";
import { useEnhancingPrompt } from "@/lib/use-enhancing-prompt";
import { cn } from "@/lib/utils";
import {
  createImageFileName,
  isDuplicateFile,
  processImageFiles,
  validateImages,
} from "@/lib/utils/image";
import { Route } from "@/routes";
import { AuthCard } from "@daveyplate/better-auth-ui";
import { useRouter } from "@tanstack/react-router";
import type { Attachment } from "ai";
import { Base64 } from "js-base64";
import {
  ArrowUpIcon,
  ImageIcon,
  Loader2Icon,
  SparklesIcon,
  Terminal,
} from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { HomeBackgroundGradient } from "./constants";

export const MAX_IMAGES = 4; // Maximum number of images that can be uploaded at once

interface SearchParams {
  input?: string;
}

export function Home() {
  const { auth } = Route.useRouteContext();

  const search = Route.useSearch() as SearchParams;
  const { enhancePrompt, isPending: isEnhancing } = useEnhancingPrompt();

  const [inputValue, setInputValue] = useState(() => {
    if (search.input) {
      try {
        return decodeURIComponent(search.input);
      } catch (e) {
        return search.input;
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
    token: auth?.session?.token || "",
    files,
  });

  const submitIsDisabled =
    isEnhancing ||
    isSubmitting ||
    isUploadingImages ||
    (inputValue.length < 8 && files.length === 0);

  const handleEnhance = async () => {
    if (!inputValue.trim()) return;
    if (auth === null) {
      setShowAuthDialog(true);
      return;
    }

    const enhanced = await enhancePrompt(inputValue);

    setInputValue(enhanced);
  };

  const doSubmit = async (input: string, name?: string) => {
    setSubmitError(null);
    if (auth === null) {
      setShowAuthDialog(true);
    } else {
      try {
        let attachments: Attachment[] | undefined = undefined;

        if (files.length > 0) {
          try {
            attachments = await uploadImages();
          } catch (error) {
            throw new Error("Failed to upload images. Please try again.");
          }
        }

        const base64Encoded = Base64.encode(
          JSON.stringify({
            requestId: crypto.randomUUID(),
            prompt: input,
            name,
            attachments,
            githubTemplateUrl:
              "https://github.com/wsxiaoys/reimagined-octo-funicular",
          }),
        );
        await navigate({
          to: "/redirect-vscode",
          search: {
            project: base64Encoded,
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

  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col items-center p-4 text-black",
        HomeBackgroundGradient,
      )}
    >
      <div className="absolute top-10 right-10">
        <UserButton
          size="icon"
          classNames={{
            content: {
              base: "mr-10",
            },
            base: "border-2",
            trigger: {
              avatar: {
                base: "transition-transform duration-300 hover:scale-110 hover:rotate-3",
              },
            },
          }}
        />
      </div>
      <h1 className="mt-[25vh] mb-12 flex gap-4 font-bold text-3xl tracking-tight md:text-5xl">
        <Terminal className="hidden size-12 animate-[spin_6s_linear_infinite] md:block" />
        What can I help you ship?
      </h1>
      <form
        className="w-full max-w-3xl rounded-lg border border-gray-300/50 bg-white/80 p-6 shadow-lg backdrop-blur-sm"
        onSubmit={handleSubmit}
      >
        {files.length > 0 && (
          <ImagePreviewList
            files={files}
            onRemove={handleRemoveImage}
            uploadingFiles={uploadingFilesMap}
          />
        )}
        <Textarea
          disabled={isSubmitting}
          onKeyDown={submitOnEnter}
          onPaste={(e) => {
            handlePasteImage(e);
          }}
          placeholder="Ask pochi to build..."
          className="mb-4 min-h-10 w-full resize-none border-none bg-transparent text-black text-lg placeholder-gray-400 shadow-none focus-visible:ring-0"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <div className="flex justify-end">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-gray-500 transition-colors hover:bg-gray-200/50 hover:text-black"
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
              className="rounded-full text-gray-500 transition-colors hover:bg-gray-200/50 hover:text-black"
              onClick={() => fileInputRef.current?.click()}
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
        handleSelectImage={() => {
          fileInputRef.current?.click();
        }}
        handleSubmit={doSubmit}
      />
      <div className="mt-4 text-right text-destructive text-sm">
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
    </div>
  );
}
