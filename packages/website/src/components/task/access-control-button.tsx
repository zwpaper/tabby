import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { apiClient } from "@/lib/auth-client";
import { useMutation } from "@tanstack/react-query";
import { CheckIcon, Loader2, Lock, Share2, Users } from "lucide-react";
import { useEffect, useState } from "react";

interface AccessControlButtonProps {
  isPublicShared: boolean;
  disabled?: boolean;
  uid: string | undefined;
  onError?: (e: Error) => void;
}

export function AccessControlButton({
  isPublicShared: initialIsPublicShared,
  disabled,
  uid,
  onError,
}: AccessControlButtonProps) {
  const [isPublicShared, setIsPublicShared] = useState(initialIsPublicShared);
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

  const shareToggleMutation = useMutation({
    mutationFn: async (newIsPublicShared: boolean) => {
      if (!uid) {
        throw new Error("Task ID is required");
      }

      if (newIsPublicShared === isPublicShared) {
        return;
      }

      const resp = await apiClient.api.tasks[":uid"].share.$post({
        param: {
          uid,
        },
        json: {
          isPublicShared: newIsPublicShared,
        },
      });

      if (!resp.ok) {
        throw new Error(resp.statusText || "Failed to update share status");
      }

      const data = await resp.json();
      if (!data.success) {
        throw new Error("Failed to update share status");
      }

      return data;
    },
    onSuccess: (_, newIsPublicShared) => {
      setIsPublicShared(newIsPublicShared);
    },
    onError: (error) => {
      const err =
        error instanceof Error
          ? error
          : new Error("Failed to update share status");
      onError?.(err);
    },
  });

  const handleToggleShare = (
    e: React.MouseEvent,
    newIsPublicShared: boolean,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (shareToggleMutation.isPending || !uid) return;
    shareToggleMutation.mutate(newIsPublicShared);
  };

  const handleCopyLink: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!uid) return;
    e.preventDefault();
    copyShareLink();
  };

  const triggerCopy = isPublicShared ? (
    <>
      <Users className="size-3.5" />
      Public
    </>
  ) : (
    <>
      <Lock className="size-3.5" />
      Private
    </>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 rounded-md text-xs transition-opacity"
          disabled={disabled || shareToggleMutation.isPending}
        >
          {triggerCopy}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={(e) => handleToggleShare(e, true)}
          disabled={shareToggleMutation.isPending}
          className="cursor-pointer"
        >
          <div className="flex items-center">
            <div className="mr-2 flex w-4 justify-center">
              {shareToggleMutation.isPending &&
              shareToggleMutation.variables === true ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isPublicShared ? (
                <CheckIcon className="size-4" />
              ) : null}
            </div>
            <div className="flex items-center gap-2 px-1.5 py-1">
              <span>Public</span>
              <span className="text-muted-foreground text-xs">
                Anyone with the link
              </span>
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={(e) => handleToggleShare(e, false)}
          disabled={shareToggleMutation.isPending}
          className="cursor-pointer"
        >
          <div className="flex items-center">
            <div className="mr-2 flex w-4 justify-center">
              {shareToggleMutation.isPending &&
              shareToggleMutation.variables === false ? (
                <Loader2 className="size-4 animate-spin" />
              ) : !isPublicShared ? (
                <CheckIcon className="size-4" />
              ) : null}
            </div>
            <div className="flex items-center gap-2 px-1.5 py-1">
              <span>Private</span>
              <span className="text-muted-foreground text-xs">
                Visible only to you
              </span>
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleCopyLink}
          disabled={shareToggleMutation.isPending || !uid}
          className="cursor-pointer"
        >
          {isCopied ? (
            <CheckIcon className="mr-2 size-4 text-success" />
          ) : (
            <Share2 className="mr-2 size-4" />
          )}
          Share Link
          {!uid && (
            <span className="ml-2 text-muted-foreground text-xs">
              (Share first)
            </span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
