import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";

interface AccordionSectionProps {
  children: React.ReactNode;
  className?: string;
  title: string;
}

export const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  children,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("py-6", className)}>
      <button
        type="button"
        className="mb-4 flex w-full items-center justify-between text-left focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="ml-1 select-none font-bold text-base">{title}</span>
        <ChevronLeft
          className={cn(
            "size-5 shrink-0 text-muted-foreground transition-transform duration-200 ease-in-out",
            isOpen ? "-rotate-90" : "",
          )}
        />
      </button>
      <div
        className={cn(
          "origin-top overflow-hidden transition-all duration-100 ease-in-out",
          isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        {children}
      </div>
    </div>
  );
};
