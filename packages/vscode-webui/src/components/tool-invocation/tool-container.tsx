import { useState } from "react";
import { ExpandIcon } from "./expand-icon";

const ToolContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <div className="flex flex-col gap-1 text-sm">{children}</div>;
};

export const ToolTitle: React.FC<{
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

export const ExpandableToolContainer: React.FC<{
  title: React.ReactNode;
  detail?: React.ReactNode;
  onToggle?: (expand: boolean) => void;
}> = ({ title, detail, onToggle }) => {
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
        className={detail ? "cursor-pointer" : undefined}
      >
        {title} {detail && <ExpandIcon isExpanded={showDetails} />}
      </ToolTitle>
      {showDetails && detail}
    </ToolContainer>
  );
};
