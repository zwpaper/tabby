import { StatusIcon } from "../status-icon";
import { ExpandableToolContainer } from "../tool-container";
import type { ToolProps } from "../types";

export const webFetchTool: React.FC<ToolProps> = ({ tool, isExecuting }) => {
  const { url } = tool.args || {};

  const title = (
    <>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2" />
      Reading
      {url && (
        <a href={url} target="_blank" className="ml-2" rel="noreferrer">
          {url}
        </a>
      )}
    </>
  );
  return <ExpandableToolContainer title={title} />;
};
