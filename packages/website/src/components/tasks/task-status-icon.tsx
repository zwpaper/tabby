import { cn } from "@/lib/utils";
import {
  Bot,
  Brain,
  CheckCircle2,
  Edit3,
  HelpCircle,
  Wrench,
  Zap,
} from "lucide-react";
import { MdOutlineErrorOutline } from "react-icons/md";

export const TaskStatusIcon = ({
  status,
  runningInBackground,
}: { status: string; runningInBackground: boolean | undefined }) => {
  const iconProps = { className: "size-5 text-muted-foreground" };
  if (runningInBackground) {
    return (
      <Bot
        className={cn(iconProps.className, "animate-bounce")}
        aria-label="Running in Background"
      />
    );
  }
  switch (status) {
    case "streaming":
      return <Zap {...iconProps} aria-label="Streaming" />;
    case "pending-tool":
      return <Wrench {...iconProps} aria-label="Pending Tool" />;
    case "pending-input":
      return <Edit3 {...iconProps} aria-label="Pending Input" />;
    case "completed":
      return <CheckCircle2 {...iconProps} aria-label="Completed" />;
    case "failed":
      return <MdOutlineErrorOutline {...iconProps} aria-label="Failed" />;
    case "pending-model":
      return <Brain {...iconProps} aria-label="Pending Model" />;
    default:
      return (
        <HelpCircle {...iconProps} aria-label={`Unknown Status: ${status}`} />
      );
  }
};
