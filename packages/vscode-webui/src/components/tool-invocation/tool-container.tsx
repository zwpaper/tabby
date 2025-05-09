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
}> = ({ onClick, children }) => {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer items-center gap-2 rounded"
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
      <ToolTitle onClick={handleToggle}>
        {title} {detail && <ExpandIcon isExpanded={showDetails} />}
      </ToolTitle>
      {showDetails && detail}
    </ToolContainer>
  );
};
