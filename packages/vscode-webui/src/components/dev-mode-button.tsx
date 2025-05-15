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
import { vscodeHost } from "@/lib/vscode"; // Corrected import
import type { UIMessage } from "@ai-sdk/ui-utils";
import { CheckIcon, CopyIcon, FilesIcon, SettingsIcon } from "lucide-react";
import type React from "react";

interface DevModeButtonProps {
  messages: UIMessage[];
}

export function DevModeButton({ messages }: DevModeButtonProps) {
  const {
    isCopied: isMessagesCopied,
    copyToClipboard: copyMessagesToClipboard,
  } = useCopyToClipboard({ timeout: 2000 });
  const { isCopied: isEnvCopied, copyToClipboard: copyEnvToClipboard } =
    useCopyToClipboard({ timeout: 2000 });

  const onCopyMessages = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMessagesCopied) return;
    const coreMessages = createCoreMessagesForCopy(messages);
    copyMessagesToClipboard(JSON.stringify(coreMessages, null, 2));
  };

  const onCopyEnvironment = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEnvCopied) return;
    const environment = await vscodeHost.readEnvironment();
    copyEnvToClipboard(JSON.stringify(environment, null, 2));
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
          <DropdownMenuItem onClick={onCopyMessages} className="cursor-pointer">
            {isMessagesCopied ? (
              <CheckIcon className="inline text-green-700 dark:text-green-500" />
            ) : (
              <CopyIcon className="inline" />
            )}
            <span className="ml-2">Copy Messages</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onCopyEnvironment}
            className="cursor-pointer"
          >
            {isEnvCopied ? (
              <CheckIcon className="inline text-green-700 dark:text-green-500" />
            ) : (
              <FilesIcon className="inline" />
            )}
            <span className="ml-2">Copy Environment</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
