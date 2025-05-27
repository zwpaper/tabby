import { ScrollArea } from "@/components/ui/scroll-area";
import { FileIcon, FolderIcon } from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";
import type { MentionListActions } from "../shared";
import {
  useMentionItems,
  useMentionKeyboardNavigation,
  useScrollIntoView,
} from "../shared";
import { formatPathForDisplay } from "../utils";

// Types for mention items (only id and filepath)
export interface MentionItem {
  isDir: boolean;
  filepath: string;
}

export interface MentionListProps {
  items: MentionItem[];
  command: (item: { id: string; filepath: string }) => void;
  query?: string;
  fetchItems?: (query?: string) => Promise<MentionItem[]>;
}

/**
 * A React component for the mention dropdown list.
 * Displays when a user types '@...' and suggestions are fetched.
 */
export const MentionList = forwardRef<MentionListActions, MentionListProps>(
  ({ items: initialItems, command, query, fetchItems }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const items = useMentionItems(initialItems, query, fetchItems);

    const handleSelect = (item: MentionItem) => {
      command({ id: item.filepath, filepath: item.filepath });
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
              {query ? "No results found" : "Type to search..."}
            </div>
          ) : (
            <div className="grid gap-0.5">
              {items.map((item, index) => (
                <MentionItemView
                  key={item.filepath}
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
  },
);

MentionList.displayName = "MentionList";

interface MentionItemViewProps {
  isSelected: boolean;
  data: MentionItem;
  onClick: () => void;
  onMouseEnter: () => void;
}

/**
 * Mention item view for displaying id and filepath
 */
function MentionItemView({ isSelected, data, ...rest }: MentionItemViewProps) {
  const ref = useScrollIntoView(isSelected);
  const { basename, displayPath } = formatPathForDisplay(data.filepath);

  return (
    <div
      className={`flex cursor-pointer flex-nowrap items-center gap-1 overflow-hidden rounded-md px-2 py-1.5 text-sm ${
        isSelected ? "bg-accent text-accent-foreground" : ""
      }`}
      {...rest}
      ref={ref}
    >
      {data.isDir ? (
        <FolderIcon className="size-4 shrink-0" />
      ) : (
        <FileIcon className="size-4 shrink-0" />
      )}
      <span className="mr-2 ml-1 truncate whitespace-nowrap font-medium ">
        {basename}
      </span>
      <span className="flex-1 truncate text-muted-foreground text-xs">
        {displayPath}
      </span>
    </div>
  );
}
