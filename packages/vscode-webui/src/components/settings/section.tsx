import { cn } from "@/lib/utils";
import type React from "react";

export interface SectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  rightElement?: React.ReactNode;
  children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({
  title,
  description,
  rightElement,
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn("py-6", className)} {...props}>
      {(title || rightElement) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="ml-1 font-bold text-base">{title}</h2>}
          {rightElement && <div>{rightElement}</div>}
        </div>
      )}
      {description && (
        <p className="mb-4 text-muted-foreground text-sm">{description}</p>
      )}
      <div className="space-y-2">{children}</div>
    </div>
  );
};
