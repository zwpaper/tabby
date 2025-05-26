import { ImageIcon, TerminalIcon } from "lucide-react";

export function EmptyChatPlaceholder() {
  return (
    <div className="flex h-full select-none flex-col items-center justify-center p-5 text-center text-gray-500 dark:text-gray-300">
      <div className="mb-4">{/* Adjusted icon color for visibility */}</div>
      <h2 className="mb-2 flex items-center gap-3 font-semibold text-2xl text-gray-700 dark:text-gray-100">
        <TerminalIcon className="animate-[spin_6s_linear_infinite]" />
        What can I help you ship?
      </h2>
      <p className="mb-4 leading-relaxed">
        Pochi is powered by AI, so errors may occur.
        <br />
        Carefully review the output before using it.
      </p>
      <ul className="m-0 list-none p-0">
        <li className="mb-2 flex items-center">
          <ImageIcon className="mr-2 size-4" /> to chat with images
        </li>
        <li className="mb-2 flex items-center">
          <span className="mr-2 text-base">@</span> to attach context
        </li>
        <li className="mb-2 flex items-center">
          <span className="mr-3 ml-1 text-base">/</span> to trigger workflow
        </li>
      </ul>
    </div>
  );
}
