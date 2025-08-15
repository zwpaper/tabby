import { MobileWarningDialog } from "@/components/home/mobile-warning-dialog";
import { ImagePreviewList } from "@/components/image-preview-list";
import { useUploadImage } from "@/components/image-preview-list/use-upload-image";
import { PromptSuggestions } from "@/components/suggestions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useGithubAuth } from "@/hooks/use-github-auth";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { PochiApiErrors } from "@ragdoll/common/pochi-api";
import {
  ArrowUpIcon,
  GlobeIcon,
  ImageIcon,
  Loader2Icon,
  MonitorIcon,
  SparklesIcon,
} from "lucide-react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { HomeBackgroundGradient } from "../home/constants";

export const MAX_IMAGES = 4; // Maximum number of images that can be uploaded at once

export function CreateTask({
  initialInput,
  className,
  initialRemote,
}: {
  initialInput?: string;
  className?: string;
  initialRemote?: boolean;
}) {
  const [isRemote, setIsRemote] = useState(initialRemote ?? true); // Default to remote
  const { data: auth } = useSession();
  const isInternalUser = useCallback(() => {
    return auth?.user?.email?.endsWith("@tabbyml.com") ?? false;
  }, [auth?.user?.email]);
  const isMobileDevice = useIsMobile();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMobileWarning, setShowMobileWarning] = useState(false);
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
  const [submitError, setSubmitError] = useState<Error | undefined>();
  const [files, setFiles] = useState<File[]>([]);
  const [imageSelectionError, setImageSelectionError] = useState<
    Error | undefined
  >(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // uploadImages,
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

  const doSubmit = async (_input: string, _name?: string) => {
    if (isMobileDevice) {
      setShowMobileWarning(true);
      return;
    }
    setSubmitError(undefined);
    if (auth === null) {
      setShowAuthDialog(true);
    } else {
      try {
        setIsSubmitting(true);
        // let attachments: Attachment[] | undefined = undefined;

        // if (files.length > 0) {
        //   try {
        //     attachments = await uploadImages();
        //   } catch (error) {
        //     throw new Error("Failed to upload images. Please try again.");
        //   }
        // }

        // const taskResponse = await apiClient.api.tasks.$post({
        //   json: {
        //     prompt: input,
        //     remote: isRemote,
        //     event: {
        //       type: "website:new-project",
        //       data: {
        //         requestId: crypto.randomUUID(),
        //         name,
        //         prompt: input,
        //         attachments,
        //         githubTemplateUrl:
        //           "https://github.com/wsxiaoys/reimagined-octo-funicular",
        //       },
        //     },
        //   },
        // });

        // if (!taskResponse.ok) {
        //   const errorMessage = await taskResponse.text();
        //   throw new Error(errorMessage);
        // }

        // const { uid, url, minionId } = await taskResponse.json();

        // if (isRemote) {
        //   await navigate({
        //     to: "/redirect-remote",
        //     search: {
        //       uid,
        //       minionId: minionId as string,
        //     },
        //   });
        // } else {
        //   await navigate({
        //     to: "/redirect-vscode",
        //     search: {
        //       uid,
        //       url,
        //     },
        //   });
        // }

        return;
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error
            : new Error("An unknown error occurred"),
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

  const submitOnEnter = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Don't submit if user is in IME composition mode (e.g., typing Chinese, Japanese, Korean)
      if (e.nativeEvent.isComposing) {
        return; // Let the IME handle the Enter key
      }
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

  // Display errors with priority: 1. imageSelectionError, 2. uploadImageError, 3. submitError
  const displayError = imageSelectionError || uploadImageError || submitError;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center p-4 pt-8 text-black dark:text-white",
        HomeBackgroundGradient,
        className,
      )}
    >
      <h2 className="mt-[10vh] mb-6 flex gap-4 font-bold text-3xl tracking-tight md:mt-[18vh] md:mb-12 md:text-5xl">
        What can I help you ship?
      </h2>
      <form
        className="relative w-full max-w-3xl overflow-hidden rounded-lg border border-gray-300/50 bg-white/80 p-6 shadow-lg backdrop-blur-sm dark:border-gray-600/50 dark:bg-gray-900/80 dark:bg-input/30"
        onSubmit={handleSubmit}
        onClick={() => {
          textareaRef.current?.focus();
        }}
      >
        <div className="absolute top-2.5 right-[-30px] w-24 rotate-45 bg-stone-200/80 py-1 text-center font-semibold text-stone-700/90 text-xs dark:bg-stone-800/80 dark:text-stone-300/90">
          Beta
        </div>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isInternalUser() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-gray-300 bg-white/90 px-3 py-1 font-medium text-xs backdrop-blur-sm transition-all duration-200 hover:border-gray-400 hover:bg-white hover:shadow-md dark:border-gray-600 dark:bg-gray-800/90 dark:hover:border-gray-500 dark:hover:bg-gray-800"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRemote(!isRemote);
                }}
              >
                {isRemote ? (
                  <>
                    <GlobeIcon className="mr-1 h-3 w-3" />
                    Remote
                  </>
                ) : (
                  <>
                    <MonitorIcon className="mr-1 h-3 w-3" />
                    Local
                  </>
                )}
              </Button>
            )}
          </div>
          <div
            className="flex items-center gap-2"
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
                e.stopPropagation(); // Prevent event bubbling to form's onClick
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
        <ErrorMessage error={displayError} />
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

function ErrorMessage({ error }: { error: Error | undefined }) {
  const { connectGithub } = useGithubAuth();

  if (!error) return;

  if (error.message === PochiApiErrors.RequireGithubIntegration) {
    return (
      <span>
        GitHub integration is required.{" "}
        <button type="button" onClick={connectGithub} className="underline">
          Connect your GitHub account
        </button>
        .
      </span>
    );
  }

  return error.message;
}
