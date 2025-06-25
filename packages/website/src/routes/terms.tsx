import { Button } from "@/components/ui/button";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Menu } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/terms")({
  component: Terms,
});

function Terms() {
  const { navigate } = useRouter();
  const [activeSection, setActiveSection] = useState("");
  const [isMobileTocOpen, setIsMobileTocOpen] = useState(false);

  const sections = [
    { id: "acceptance", title: "Acceptance of Terms" },
    { id: "service-description", title: "Description of Service" },
    { id: "user-accounts", title: "User Accounts and Registration" },
    { id: "acceptable-use", title: "Acceptable Use Policy" },
    { id: "intellectual-property", title: "Intellectual Property Rights" },
    { id: "payment-terms", title: "Payment Terms and Billing" },
    {
      id: "service-availability",
      title: "Service Availability and Modifications",
    },
    { id: "limitation-liability", title: "Limitation of Liability" },
    { id: "termination", title: "Termination" },
    { id: "governing-law", title: "Governing Law and Dispute Resolution" },
    { id: "changes", title: "Changes to These Terms" },
    { id: "contact", title: "Contact Information" },
  ];

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
  }, []);

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
          Terms of Service
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
                Last updated: [Date to be filled]
              </div>

              {/* Introduction */}
              <section id="acceptance" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Acceptance of Terms
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  [Terms acceptance and introduction content to be filled by
                  user]
                </p>
              </section>

              {/* Service Description */}
              <section id="service-description" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Description of Service
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  [Service description content to be filled by user]
                </p>
              </section>

              {/* User Accounts */}
              <section id="user-accounts" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  User Accounts and Registration
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-foreground text-lg">
                      Account Creation
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      [Account creation requirements to be filled by user]
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium text-foreground text-lg">
                      Account Security
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      [Account security responsibilities to be filled by user]
                    </p>
                  </div>
                </div>
              </section>

              {/* Acceptable Use */}
              <section id="acceptable-use" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Acceptable Use Policy
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  [Acceptable use policy content to be filled by user]
                </p>
              </section>

              {/* Intellectual Property */}
              <section id="intellectual-property" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Intellectual Property Rights
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  [Intellectual property rights content to be filled by user]
                </p>
              </section>

              {/* Payment Terms */}
              <section id="payment-terms" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Payment Terms and Billing
                </h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-foreground text-lg">
                      Subscription Plans
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      [Subscription plans information to be filled by user]
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium text-foreground text-lg">
                      Billing and Refunds
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      [Billing and refund policy to be filled by user]
                    </p>
                  </div>
                </div>
              </section>

              {/* Service Availability */}
              <section id="service-availability" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Service Availability and Modifications
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  [Service availability and modification terms to be filled by
                  user]
                </p>
              </section>

              {/* Limitation of Liability */}
              <section id="limitation-liability" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Limitation of Liability
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  [Limitation of liability content to be filled by user]
                </p>
              </section>

              {/* Termination */}
              <section id="termination" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Termination
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  [Termination terms to be filled by user]
                </p>
              </section>

              {/* Governing Law */}
              <section id="governing-law" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Governing Law and Dispute Resolution
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  [Governing law and dispute resolution content to be filled by
                  user]
                </p>
              </section>

              {/* Changes to Terms */}
              <section id="changes" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Changes to These Terms
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  [Terms change notification process to be filled by user]
                </p>
              </section>

              {/* Contact Information */}
              <section id="contact" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Contact Information
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  [Contact information for legal inquiries to be filled by user]
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
