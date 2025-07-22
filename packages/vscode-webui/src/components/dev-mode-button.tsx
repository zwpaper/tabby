import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsDevMode } from "@/features/settings";
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard";
import { createCoreMessagesForCopy } from "@/lib/utils/message";
import { vscodeHost } from "@/lib/vscode";
import type { UIMessage } from "@ai-sdk/ui-utils";
import type { Todo } from "@getpochi/tools";
import type { Environment } from "@ragdoll/db";
import { useRouter } from "@tanstack/react-router";
import { Bot, CheckIcon, CopyIcon, SettingsIcon } from "lucide-react"; // Removed FilesIcon
import type React from "react";
import { useCallback } from "react";

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
        <CheckIcon className="inline text-success" />
      ) : (
        <CopyIcon className="inline" />
      )}
      <span className="ml-2">{text}</span>
    </DropdownMenuItem>
  );
}

interface DevModeButtonProps {
  messages: UIMessage[];
  todos: Todo[] | undefined;
  buildEnvironment: () => Promise<Environment>;
  uid: string | undefined;
  selectedModel?: string;
}

export function DevModeButton({
  messages,
  buildEnvironment,
  todos,
  uid,
  selectedModel,
}: DevModeButtonProps) {
  const [isDevMode] = useIsDevMode();
  if (!isDevMode) return null;
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

  const getTodosContent = () => {
    return JSON.stringify(todos, null, 2);
  };

  const { navigate } = useRouter();

  const handleRunInBackground = useCallback(() => {
    if (!uid) {
      return;
    }
    vscodeHost.runTask(uid, { model: selectedModel });
    navigate({ to: "/runner", replace: true, search: { uid } });
  }, [uid, navigate, selectedModel]);

  const getCheckpintCommand = useCallback(async () => {
    const checkpointPath = await vscodeHost.readCheckpointPath();
    if (!checkpointPath) {
      return "No checkpoint available";
    }
    const workspaceFolder = await vscodeHost.readCurrentWorkspace();
    return `alias pgit="git --git-dir=\\"${checkpointPath}\\" --work-tree=\\"${workspaceFolder}\\""`;
  }, []);

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
          <CopyMenuItem
            fetchContent={getCheckpintCommand}
            text="Copy Checkpoint Command"
          />
          <CopyMenuItem fetchContent={getTodosContent} text="Copy TODOs" />
          {uid && (
            <DropdownMenuItem
              onClick={handleRunInBackground}
              className="cursor-pointer"
            >
              <Bot className="inline" />
              <span className="ml-2">Run in Background</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
