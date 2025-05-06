import type { SuggestionKeyDownProps } from "@tiptap/suggestion";
import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// Types for mention items (only id and filepath)
export interface MentionItem {
  id: string;
  filepath: string;
}

export interface MentionListActions {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
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
    const [items, setItems] = useState<MentionItem[]>(initialItems);

    // Fetch items on mount and when query changes
    useLayoutEffect(() => {
      let active = true;
      if (fetchItems) {
        fetchItems(query).then((newItems) => {
          if (active) setItems(newItems);
        });
      } else {
        setItems(initialItems);
      }
      return () => {
        active = false;
      };
    }, [fetchItems, query, initialItems]);

    const handleSelect = (item: MentionItem) => {
      command({ id: item.id, filepath: item.filepath });
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        const lastIndex = items.length - 1;
        let newIndex = selectedIndex;

        switch (event.key) {
          case "ArrowUp":
            newIndex = Math.max(0, selectedIndex - 1);
            break;
          case "ArrowDown":
            newIndex = Math.min(lastIndex, selectedIndex + 1);
            break;
          case "Enter":
            if (items[selectedIndex]) {
              handleSelect(items[selectedIndex]);
            }
            return true;
          default:
            return false;
        }

        setSelectedIndex(newIndex);
        return true;
      },
    }));

    return (
      <div className="relative flex max-h-[300px] w-[80vw] flex-col overflow-hidden rounded-md border bg-popover p-1 sm:w-[600px]">
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-2 py-1.5 text-muted-foreground text-xs">
              {query ? "No results found" : "Type to search..."}
            </div>
          ) : (
            <div className="grid gap-0.5">
              {items.map((item, index) => (
                <MentionItemView
                  key={`${item.id}-${index}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  isSelected={index === selectedIndex}
                  data={item}
                />
              ))}
            </div>
          )}
        </div>
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
  const ref = useRef<HTMLDivElement>(null);
  const { basename, displayPath } = formatPathForDisplay(data.filepath);

  useLayoutEffect(() => {
    if (isSelected && ref.current) {
      ref.current?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [isSelected]);

  return (
    <div
      className={`flex cursor-pointer flex-nowrap items-center gap-1 overflow-hidden rounded-md px-2 py-1.5 text-sm ${
        isSelected ? "bg-accent text-accent-foreground" : ""
      }`}
      {...rest}
      ref={ref}
    >
      <span className="mr-2 truncate whitespace-nowrap font-medium ">
        {basename}
      </span>
      <span className="flex-1 truncate text-muted-foreground text-xs">
        {displayPath}
      </span>
    </div>
  );
}

/**
 * Extracts basename and formats path for display
 */
function formatPathForDisplay(filepath: string): {
  basename: string;
  displayPath: string;
} {
  // FIXME: hack way to handle both Unix and Windows paths
  const separator = filepath.includes("\\") ? "\\" : "/";
  const parts = filepath.split(separator);
  const basename = parts[parts.length - 1];

  // Format display path (excluding basename)
  const displayPath = parts.slice(0, -1).join(separator);

  return { basename, displayPath };
}
