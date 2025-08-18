import { TaskThread, type TaskThreadSource } from "@/components/task-thread";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { StatusIcon } from "../../status-icon";
import { ExpandIcon, ToolTitle } from "../../tool-container";
import type { ToolProps } from "../../types";
import { useInlinedSubTask } from "./use-inlined-sub-task";
import { useLiveSubTask } from "./use-live-sub-task";

interface NewTaskToolProps extends ToolProps<"newTask"> {
  // For storybook visualization
  taskThreadSource?: TaskThreadSource;
}

export const newTaskTool: React.FC<NewTaskToolProps> = ({
  tool,
  isExecuting,
  taskThreadSource,
}) => {
  const uid = tool.input?._meta?.uid;
  const description = tool.input?.description ?? "";

  let isLiveTaskSource = false;
  let taskSource = taskThreadSource;

  const inlinedTaskSource = useInlinedSubTask(tool);
  if (inlinedTaskSource) {
    taskSource = inlinedTaskSource;
  } else if (uid) {
    taskSource = useLiveSubTask({ tool, isExecuting });
    isLiveTaskSource = true;
  }

  const [showMessageList, setShowMessageList] = useState(false);

  const hasContent = taskSource && taskSource.messages.length > 1;
  const autoShowMessageListOnce = useRef(hasContent);
  useEffect(() => {
    if (!showMessageList && !autoShowMessageListOnce.current && hasContent) {
      autoShowMessageListOnce.current = true;
      setShowMessageList(true);
    }
  }, [showMessageList, hasContent]);

  const autoCloseMessageListOnce = useRef(tool.state === "output-available");
  useEffect(() => {
    if (
      !autoCloseMessageListOnce.current &&
      tool.state === "output-available"
    ) {
      autoCloseMessageListOnce.current = true;
      setTimeout(() => {
        setShowMessageList(false);
      }, 1_500);
    }
  }, [tool.state]);

  return (
    <div>
      <ToolTitle>
        <span className={cn("flex items-center gap-2")}>
          <div>
            <StatusIcon tool={tool} isExecuting={isExecuting} />
            <Badge variant="secondary" className={cn("mr-1 ml-2 py-0")}>
              {isLiveTaskSource ? (
                <Link to="/" search={{ uid, ts: Date.now() }} replace={true}>
                  Subtask
                </Link>
              ) : (
                <>Subtask</>
              )}
            </Badge>
            <span className="ml-2">{description}</span>
          </div>
        </span>
        {taskSource && taskSource.messages.length > 1 && (
          <ExpandIcon
            className="cursor-pointer"
            isExpanded={showMessageList}
            onClick={() => setShowMessageList(!showMessageList)}
          />
        )}
      </ToolTitle>
      {taskSource && (
        <TaskThread source={taskSource} showMessageList={showMessageList} />
      )}
    </div>
  );
};
