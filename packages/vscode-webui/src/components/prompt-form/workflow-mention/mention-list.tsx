import { ScrollArea } from "@/components/ui/scroll-area";
import { vscodeHost } from "@/lib/vscode";
import { FileIcon } from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";
import type { MentionListActions } from "../shared";
import {
  useMentionItems,
  useMentionKeyboardNavigation,
  useScrollIntoView,
} from "../shared";

// Types for workflow items
export interface WorkflowItem {
  id: string;
  path: string;
  content: string;
}

export interface WorkflowListProps {
  items: WorkflowItem[];
  command: (item: { id: string; path: string; content: string }) => void;
  query?: string;
  fetchItems?: (query?: string) => Promise<WorkflowItem[]>;
}

/**
 * A React component for the workflow dropdown list.
 * Displays when a user types '/...' and suggestions are fetched.
 * Reads the file content when a workflow is selected.
 */
export const WorkflowMentionList = forwardRef<
  MentionListActions,
  WorkflowListProps
>(({ items: initialItems, command, query, fetchItems }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const items = useMentionItems(initialItems, query, fetchItems);

  const handleSelect = async (item: WorkflowItem) => {
    vscodeHost.capture({
      event: "selectWorkflow",
      properties: {
        workflowId: item.id,
      },
    });
    command(item);
  };

  const keyboardNavigation = useMentionKeyboardNavigation(
    items,
    selectedIndex,
    setSelectedIndex,
    handleSelect,
  );

  useImperativeHandle(ref, () => keyboardNavigation);

  return (
    <div className="relative flex w-[80vw] flex-col overflow-hidden py-1 sm:w-[600px]">
      <ScrollArea viewportClassname="max-h-[300px] px-2">
        {items.length === 0 ? (
          <div className="px-2 py-1.5 text-muted-foreground text-xs">
            {query ? "No workflows found" : "Type to search workflows..."}
          </div>
        ) : (
          <div className="grid gap-0.5">
            {items.map((item, index) => (
              <WorkflowItemView
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                isSelected={index === selectedIndex}
                data={item}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
});

WorkflowMentionList.displayName = "WorkflowMentionList";

interface WorkflowItemViewProps {
  isSelected: boolean;
  data: WorkflowItem;
  onClick: () => void;
  onMouseEnter: () => void;
}

/**
 * Workflow item view for displaying workflow files
 */
function WorkflowItemView({
  isSelected,
  data,
  ...rest
}: WorkflowItemViewProps) {
  const ref = useScrollIntoView(isSelected);

  return (
    <div
      className={`flex cursor-pointer flex-nowrap items-center gap-1 overflow-hidden rounded-md px-2 py-1.5 text-sm ${
        isSelected ? "bg-accent text-accent-foreground" : ""
      }`}
      {...rest}
      ref={ref}
    >
      <FileIcon className="size-4 shrink-0" />
      <span className="mr-2 ml-1 truncate whitespace-nowrap font-medium">
        {data.id}
      </span>
    </div>
  );
}
