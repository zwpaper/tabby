import { Button } from "@/components/ui/button";
import { useRouter } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Menu } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

interface Section {
  id: string;
  title: string;
}

interface LegalPageProps {
  title: string;
  lastModified: string;
  sections: Section[];
  children: ReactNode;
}

export function LegalPage({
  title,
  lastModified,
  sections,
  children,
}: LegalPageProps) {
  const { navigate } = useRouter();
  const [activeSection, setActiveSection] = useState("");
  const [isMobileTocOpen, setIsMobileTocOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;

      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element) {
          const offsetTop = element.offsetTop;
          const offsetBottom = offsetTop + element.offsetHeight;

          if (scrollPosition >= offsetTop && scrollPosition < offsetBottom) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [sections]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Main content */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex w-full items-center justify-between">
          <Button
            onClick={() => navigate({ to: "/" })}
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
          >
            ← Back to Home
          </Button>
        </div>

        {/* Title */}
        <h1 className="mb-8 text-center font-bold text-3xl text-foreground md:text-4xl">
          {title}
        </h1>

        {/* Mobile Table of Contents */}
        <div className="mb-6 lg:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsMobileTocOpen(!isMobileTocOpen)}
            className="flex w-full items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Menu className="h-4 w-4" />
              Table of Contents
            </span>
            {isMobileTocOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          {isMobileTocOpen && (
            <div className="mt-4 rounded-lg border bg-card p-4">
              <nav className="space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => {
                      scrollToSection(section.id);
                      setIsMobileTocOpen(false);
                    }}
                    className={`block w-full rounded px-2 py-2 text-left text-sm transition-colors ${
                      activeSection === section.id
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>

        <div className="flex gap-8">
          {/* Desktop Table of Contents */}
          <div className="hidden w-64 flex-shrink-0 lg:block">
            <div>
              <h3 className="mb-4 font-semibold text-foreground text-sm uppercase tracking-wide">
                Table of Contents
              </h3>
              <nav className="space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={`block w-full rounded px-2 py-1 text-left text-sm transition-colors ${
                      activeSection === section.id
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Content Container */}
            <div className="w-full space-y-8 text-left">
              {/* Last Updated */}
              <div className="text-center text-muted-foreground text-sm">
                {lastModified}
              </div>

              {/* Dynamic Content */}
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
