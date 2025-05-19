import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TriangleAlertIcon } from "lucide-react";
import { CodeBlock } from "../message";

export const NewProblems: React.FC<{
  newProblems: string;
}> = ({ newProblems }) => {
  return (
    <div className="my-2 ml-1 flex flex-col">
      <CodeBlock className="" language="log" value={newProblems} />
      <p className="mt-1 self-center text-xs italic">
        Above problems have been detected after the change
      </p>
    </div>
  );
};

export const NewProblemsIcon: React.FC = () => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <TriangleAlertIcon className="size-3 text-yellow-600 dark:text-yellow-400" />
      </TooltipTrigger>
      <TooltipContent>
        <p className="m-0">Problems detected after change</p>
      </TooltipContent>
    </Tooltip>
  );
};
