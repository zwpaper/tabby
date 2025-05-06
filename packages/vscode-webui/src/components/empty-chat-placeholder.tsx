import { ImageIcon, TerminalIcon } from "lucide-react";

export function EmptyChatPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-gray-300 p-5 select-none">
      <div className="mb-4">{/* Adjusted icon color for visibility */}</div>
      <h2 className="text-2xl font-semibold mb-2 text-gray-100 flex gap-3 items-center">
        <TerminalIcon className="animate-[spin_6s_linear_infinite]" />
        What can I help you ship?
      </h2>
      <p className="mb-4 leading-relaxed">
        Pochi is powered by AI, so errors may occur.
        <br />
        Carefully review the output before using it.
      </p>
      <ul className="list-none p-0 m-0">
        <li className="mb-2 flex items-center">
          <ImageIcon className="mr-2 size-4" /> to chat with images
        </li>
        <li className="mb-2 flex items-center">
          <span className="mr-2  text-base">@</span> to attach context
        </li>
      </ul>
    </div>
  );
}
