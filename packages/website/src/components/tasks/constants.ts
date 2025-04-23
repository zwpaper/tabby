import {
  Brain,
  CheckCircle,
  Keyboard,
  type LucideIcon,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import type { Task } from "./types";

export const statuses = [
  {
    value: "streaming",
    label: "Streaming",
    icon: Brain,
  },
  {
    value: "pending-tool",
    label: "Invoking tool",
    icon: Wrench,
  },
  {
    value: "pending-input",
    label: "Pending",
    icon: Keyboard,
  },
  {
    value: "completed",
    label: "Completed",
    icon: CheckCircle,
  },
  {
    value: "failed",
    label: "Failed",
    icon: TriangleAlert,
  },
] satisfies {
  value: Task["status"];
  label: string;
  icon: LucideIcon;
}[];
