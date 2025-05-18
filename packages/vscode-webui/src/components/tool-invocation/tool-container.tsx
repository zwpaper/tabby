import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

const ToolContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <div className="flex flex-col gap-1 text-sm">{children}</div>;
};

const ToolTitle: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ onClick, children, className }) => {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2 break-words rounded text-sm ${className}`}
    >
      {children}
    </div>
  );
};

const ExpandIcon: React.FC<{
  isExpanded: boolean;
  onClick?: () => void;
  className?: string;
}> = ({ isExpanded, onClick, className }) => {
  return (
    <span
      className={cn(
        "mt-0.5 self-start rounded bg-muted p-1 hover:bg-accent",
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

export const ExpandableToolContainer: React.FC<{
  title: React.ReactNode;
  expandableDetail?: React.ReactNode;
  detail?: React.ReactNode;
  onToggle?: (expand: boolean) => void;
}> = ({ title, expandableDetail, detail, onToggle }) => {
  const [showDetails, setShowDetails] = useState(false);

  const handleToggle = () => {
    setShowDetails(!showDetails);
    if (onToggle) {
      onToggle(!showDetails);
    }
  };

  return (
    <ToolContainer>
      <ToolTitle
        onClick={handleToggle}
        className={expandableDetail ? "cursor-pointer" : undefined}
      >
        <span className="pr-1 leading-relaxed">{title}</span>
        {expandableDetail && <ExpandIcon isExpanded={showDetails} />}
      </ToolTitle>
      {showDetails && expandableDetail}
      {detail}
    </ToolContainer>
  );
};
