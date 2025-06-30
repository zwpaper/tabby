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
import { vscodeHost } from "@/lib/vscode";
import { useMutation } from "@tanstack/react-query";
import {
  CheckIcon,
  CopyIcon,
  Loader2,
  MessageSquareShare,
  Share2Icon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface PublicShareButtonProps {
  isPublicShared: boolean;
  disabled?: boolean;
  uid: string | undefined;
  onError?: (e: Error) => void;
  modelId?: string;
}

export function PublicShareButton({
  isPublicShared: initialIsPublicShared,
  disabled,
  uid,
  onError,
  modelId,
}: PublicShareButtonProps) {
  const menuItemRef = useRef<"share" | "support">();
  const [isPublicShared, setIsPublicShared] = useState(initialIsPublicShared);
  const [open, setOpen] = useState(false);
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 });

  const doCopy = (content: string) => {
    if (isCopied) return;
    copyToClipboard(content);
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

      // Capture sharePublic event when user shares a thread publicly
      if (newIsPublicShared) {
        vscodeHost.capture({
          event: "sharePublic",
        });
      }
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
    menuItemRef.current = "share";
    e.preventDefault();
    doCopy(`https://app.getpochi.com/share/${uid}`);
  };

  const handleShareSupport: React.MouseEventHandler<HTMLDivElement> = async (
    e,
  ) => {
    if (!uid) return;
    menuItemRef.current = "support";
    e.preventDefault();
    const version = await vscodeHost.readExtensionVersion();
    doCopy(`Extension version: ${version}
Model            : ${modelId}
Link        : https://app.getpochi.com/share/${uid}`);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-md p-0 transition-opacity"
          disabled={disabled || shareToggleMutation.isPending}
        >
          <Share2Icon className="size-4" />
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
          {menuItemRef.current === "share" && isCopied ? (
            <CheckIcon className="mr-2 size-4 text-success" />
          ) : (
            <CopyIcon className="mr-2 size-4" />
          )}
          Copy link
          {!uid && (
            <span className="ml-2 text-muted-foreground text-xs">
              (Share first)
            </span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleShareSupport}
          disabled={shareToggleMutation.isPending || !uid}
          className="cursor-pointer"
        >
          {menuItemRef.current === "support" && isCopied ? (
            <CheckIcon className="mr-2 size-4 text-success" />
          ) : (
            <MessageSquareShare className="mr-2 size-4" />
          )}
          Share with Support
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
