import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";
import type React from "react";

const sectionContainerVariants = cva(
  "", // Base container styles
  {
    variants: {
      variant: {
        section: "pt-6",
        subsection: "",
      },
    },
    defaultVariants: {
      variant: "section",
    },
  },
);

const sectionTitleVariants = cva(
  "ml-1", // Common title styles
  {
    variants: {
      variant: {
        section: "font-bold text-base",
        subsection: "font-semibold text-foreground/80 text-sm",
      },
    },
    defaultVariants: {
      variant: "section",
    },
  },
);

export interface SectionProps {
  title: string | React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
  variant?: "section" | "subsection";
}

export const Section: React.FC<SectionProps> = ({
  title,
  description,
  children,
  className,
  variant = "section",
  ...props
}) => {
  return (
    <div
      className={cn(sectionContainerVariants({ variant }), className)}
      {...props}
    >
      <div className="mb-4 flex select-none items-center justify-between">
        <h2 className={sectionTitleVariants({ variant })}>{title}</h2>
      </div>
      {description && (
        <p className="mb-4 text-muted-foreground text-sm">{description}</p>
      )}
      <div className="space-y-2">{children}</div>
    </div>
  );
};

// Keep SubSection as an alias for backward compatibility during migration
export const SubSection: React.FC<SectionProps> = (props) => {
  return <Section {...props} variant="subsection" />;
};
