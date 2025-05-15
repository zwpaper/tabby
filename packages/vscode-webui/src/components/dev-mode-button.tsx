import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard";
import { createCoreMessagesForCopy } from "@/lib/message-utils";
import type { UIMessage } from "@ai-sdk/ui-utils";
import { CheckIcon, CopyIcon, SettingsIcon } from "lucide-react";
import type React from "react";

interface DevModeButtonProps {
  messages: UIMessage[];
}

export function DevModeButton({ messages }: DevModeButtonProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 });

  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCopied) return;
    const coreMessages = createCoreMessagesForCopy(messages);
    copyToClipboard(JSON.stringify(coreMessages, null, 2));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-md p-0"
          title="Dev mode"
        >
          <SettingsIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          onCloseAutoFocus={(e) => e.preventDefault()}
          side="bottom"
          className="dropdown-menu max-h-[30vh] min-w-[12rem] animate-in overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-2 text-popover-foreground shadow"
        >
          <DropdownMenuItem onClick={onCopy} className="cursor-pointer">
            {isCopied ? (
              <CheckIcon className="inline text-green-700 dark:text-green-500" />
            ) : (
              <CopyIcon className="inline" />
            )}
            <span className="ml-2">Copy Messages</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
