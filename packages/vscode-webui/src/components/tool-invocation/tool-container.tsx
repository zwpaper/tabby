import { useState } from "react";
import { ExpandIcon } from "./expand-icon";

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
      className={`flex items-center gap-2 break-all rounded text-sm ${className}`}
    >
      {children}
    </div>
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
        <span className="break-words pr-1 ">{title}</span>
        {expandableDetail && <ExpandIcon isExpanded={showDetails} />}
      </ToolTitle>
      {showDetails && expandableDetail}
      {detail}
    </ToolContainer>
  );
};
