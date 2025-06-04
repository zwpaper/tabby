import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient } from "@/lib/auth-client";
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard";
import { CheckIcon, CopyIcon, Loader2, Share2Icon } from "lucide-react";
import { useEffect, useState } from "react";

interface PublicShareButtonProps {
  isPublicShared: boolean;
  disabled?: boolean;
  taskId: number | undefined;
  uid: string | undefined;
  onError?: (e: Error) => void;
}

export function PublicShareButton({
  isPublicShared: initialIsPublicShared,
  disabled,
  taskId,
  uid,
  onError,
}: PublicShareButtonProps) {
  const [isPublicShared, setIsPublicShared] = useState(initialIsPublicShared);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 });

  const copyShareLink = () => {
    if (isCopied || !uid) return;
    copyToClipboard(`https://app.getpochi.com/share/${uid}`);
    setTimeout(() => {
      setOpen(false);
    }, 1000);
  };

  useEffect(() => {
    setIsPublicShared(initialIsPublicShared);
  }, [initialIsPublicShared]);

  const onShareToPublic = async () => {
    if (!taskId) return;
    try {
      setIsSubmitting(true);
      const resp = await apiClient.api.tasks[":id"].share.$post({
        param: {
          id: taskId.toString(),
        },
        json: {
          isPublicShared: true,
        },
      });
      if (!resp.ok) {
        throw new Error(resp.statusText || "Failed to share task");
      }
      const data = await resp.json();
      if (data.success) {
        setIsSubmitting(false);
        copyShareLink();
        setTimeout(() => {
          setIsPublicShared(true);
        }, 1200);
      } else {
        throw new Error("Failed to share task");
      }
    } catch (e) {
      const error = e instanceof Error ? e : new Error("Failed to share task");
      onError?.(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareToPublicClick: React.MouseEventHandler<HTMLDivElement> = (
    e,
  ) => {
    e.preventDefault();
    onShareToPublic();
  };

  const handleCopyLink: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!uid) return;

    e.preventDefault();
    copyShareLink();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-md p-0 transition-opacity"
          disabled={disabled || isSubmitting}
        >
          <Share2Icon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="flex items-center gap-2 px-2 py-1.5">
          {isPublicShared ? (
            <CheckIcon className="mr-2 size-4" />
          ) : (
            <div className="mr-2 w-4" /> // Placeholder for alignment
          )}
          Public
          <span className="truncate font-normal text-muted-foreground">
            {" "}
            (anyone with the link)
          </span>
        </div>
        <div className="flex items-center gap-2 px-2 py-1.5">
          {!isPublicShared ? (
            <CheckIcon className="mr-2 size-4" />
          ) : (
            <div className="mr-2 w-4" /> // Placeholder for alignment
          )}
          Private
          <span className="truncate font-normal text-muted-foreground">
            {" "}
            (visible only to you)
          </span>
        </div>

        <DropdownMenuSeparator />

        {isPublicShared && uid && (
          <DropdownMenuItem onClick={handleCopyLink} disabled={isSubmitting}>
            {isCopied ? (
              <CheckIcon className="mr-2 size-4 text-success" />
            ) : (
              <CopyIcon className="mr-2 size-4" />
            )}
            Copy link
          </DropdownMenuItem>
        )}
        {!isPublicShared && (
          <DropdownMenuItem
            onClick={handleShareToPublicClick}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : isCopied ? (
              <CheckIcon className="mr-2 size-4 text-success" />
            ) : (
              <Share2Icon className="mr-2 size-4" />
            )}
            Share to public
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
