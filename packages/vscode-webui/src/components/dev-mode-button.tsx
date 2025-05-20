import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard";
import { createCoreMessagesForCopy } from "@/lib/utils/message";
import type { UIMessage } from "@ai-sdk/ui-utils";
import type { Environment } from "@ragdoll/server";
import { CheckIcon, CopyIcon, SettingsIcon } from "lucide-react"; // Removed FilesIcon
import type React from "react";

interface UpdatedCopyMenuItemProps {
  fetchContent: () => Promise<string> | string; // Can be sync or async
  text: string;
}

function CopyMenuItem({ fetchContent, text }: UpdatedCopyMenuItemProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 });

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCopied) return;
    const contentToCopy = await Promise.resolve(fetchContent());
    copyToClipboard(contentToCopy);
  };

  return (
    <DropdownMenuItem onClick={handleClick} className="cursor-pointer">
      {isCopied ? (
        <CheckIcon className="inline text-green-700 dark:text-green-500" />
      ) : (
        <CopyIcon className="inline" />
      )}
      <span className="ml-2">{text}</span>
    </DropdownMenuItem>
  );
}

interface DevModeButtonProps {
  messages: UIMessage[];
  buildEnvironment: () => Promise<Environment>;
}

export function DevModeButton({
  messages,
  buildEnvironment,
}: DevModeButtonProps) {
  const getMessagesContent = () => {
    const x = messages.map((x) => {
      return {
        ...x,
        toolInvocations: undefined,
      };
    });
    return JSON.stringify(x, null, 2);
  };
  const getCoreMessagesContent = () => {
    const coreMessages = createCoreMessagesForCopy(messages);
    return JSON.stringify(coreMessages, null, 2);
  };

  const getEnvironmentContent = async () => {
    const environment = await buildEnvironment();
    return JSON.stringify(environment, null, 2);
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
          <CopyMenuItem
            fetchContent={getMessagesContent}
            text="Copy Messages"
          />
          <CopyMenuItem
            fetchContent={getCoreMessagesContent}
            text="Copy Core Messages"
          />
          <CopyMenuItem
            fetchContent={getEnvironmentContent}
            text="Copy Environment"
          />
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
