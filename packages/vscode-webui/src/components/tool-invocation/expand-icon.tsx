import { ChevronRight } from "lucide-react";

export const ExpandIcon: React.FC<{
  isExpanded: boolean;
  onClick?: () => void;
}> = ({ isExpanded, onClick }) => {
  return (
    <span className="my-1 self-start rounded bg-muted p-1" onClick={onClick}>
      {isExpanded ? (
        <ChevronRight className="size-3 rotate-90" />
      ) : (
        <ChevronRight className="size-3 rotate-180" />
      )}
    </span>
  );
};
