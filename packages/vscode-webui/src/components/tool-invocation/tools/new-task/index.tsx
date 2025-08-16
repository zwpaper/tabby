import { TaskThread } from "@/components/task-thread";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsAtBottom } from "@/lib/hooks/use-is-at-bottom";
import { cn } from "@/lib/utils";

import { Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { StatusIcon } from "../../status-icon";
import { ExpandIcon, ToolTitle } from "../../tool-container";
import type { ToolProps } from "../../types";
import { useInlinedSubTask } from "./use-inlined-sub-task";
import { useLiveSubTask } from "./use-live-sub-task";

export const newTaskTool: React.FC<ToolProps<"newTask">> = ({
  tool,
  isExecuting,
}) => {
  // biome-ignore lint/style/noNonNullAssertion: uid must have been set.
  const uid = tool.input?._meta?.uid!;
  const description = tool.input?.description ?? "";

  const inlinedSubTask = useInlinedSubTask(tool);
  const taskSource = inlinedSubTask ?? useLiveSubTask({ tool, isExecuting });

  const [showMessageList, setShowMessageList] = useState(false);
  const newTaskContainer = useRef<HTMLDivElement>(null);
  const { isAtBottom, scrollToBottom } = useIsAtBottom(newTaskContainer);
  const isAtBottomRef = useRef(isAtBottom);

  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  // Scroll to bottom when the message list height changes
  useEffect(() => {
    if (!showMessageList) {
      return;
    }
    const container = newTaskContainer.current;
    if (!container?.children[0]) {
      return;
    }
    const resizeObserver = new ResizeObserver(() => {
      if (isAtBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom());
      }
    });
    resizeObserver.observe(container);
    resizeObserver.observe(container.children[0]);
    return () => {
      resizeObserver.disconnect();
    }; // clean up
  }, [scrollToBottom, showMessageList]);

  // Initial scroll to bottom once when component mounts (without smooth behavior)
  useLayoutEffect(() => {
    if (newTaskContainer.current) {
      scrollToBottom(false); // false = not smooth
    }
  }, [scrollToBottom]);

  return (
    <div>
      <ToolTitle>
        <span className={cn("flex items-center gap-2")}>
          <div>
            <StatusIcon tool={tool} isExecuting={isExecuting} />
            <Badge variant="secondary" className={cn("mr-1 ml-2 py-0")}>
              {inlinedSubTask ? (
                <>Subtask</>
              ) : (
                <Link to="/" search={{ uid, ts: Date.now() }} replace={true}>
                  Subtask
                </Link>
              )}
            </Badge>
            <span className="ml-2">{description}</span>
          </div>
        </span>
        {taskSource.messages.length > 1 && (
          <ExpandIcon
            className="cursor-pointer"
            isExpanded={showMessageList}
            onClick={() => setShowMessageList(!showMessageList)}
          />
        )}
      </ToolTitle>
      {taskSource && (
        <ScrollArea viewportClassname="max-h-[300px]" ref={newTaskContainer}>
          <TaskThread source={taskSource} showMessageList={showMessageList} />
        </ScrollArea>
      )}
    </div>
  );
};
