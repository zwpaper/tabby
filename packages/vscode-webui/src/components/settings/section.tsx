import { cn } from "@/lib/utils";
import type React from "react";

export interface SectionProps {
  title?: string | React.ReactNode;
  description?: string;
  rightElement?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Section: React.FC<SectionProps> = ({
  title,
  description,
  rightElement,
  children,
  className,
}) => {
  return (
    <div className={cn("pt-6", className)}>
      {(title || rightElement) && (
        <div className="mb-4 flex select-none items-center justify-between">
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

export const SubSection: React.FC<SectionProps> = ({
  title,
  description,
  rightElement,
  children,
  className,
  ...props
}) => {
  return (
    <div className={className} {...props}>
      {(title || rightElement) && (
        <div className="mb-2 flex select-none items-center justify-between">
          {title && (
            <h2 className="ml-1 font-semibold text-foreground/80 text-sm">
              {title}
            </h2>
          )}
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
