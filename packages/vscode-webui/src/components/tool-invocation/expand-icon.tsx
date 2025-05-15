import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export const ExpandIcon: React.FC<{
  isExpanded: boolean;
  onClick?: () => void;
  className?: string;
}> = ({ isExpanded, onClick, className }) => {
  return (
    <span
      className={cn(
        "self-start rounded bg-muted p-1 hover:bg-secondary",
        className,
      )}
      onClick={onClick}
    >
      {isExpanded ? (
        <ChevronRight className="size-3 rotate-90" />
      ) : (
        <ChevronRight className="size-3 rotate-180" />
      )}
    </span>
  );
};
