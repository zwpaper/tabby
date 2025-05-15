import { CodeBlock } from "../message";

export const NewProblems: React.FC<{
  newProblems: string;
}> = ({ newProblems }) => {
  return (
    <div className="my-2 ml-1 flex flex-col">
      <CodeBlock className="" language="log" value={newProblems} />
      <p className="mt-1 self-center text-sm italic">
        Following problems have been detected for the change
      </p>
    </div>
  );
};
