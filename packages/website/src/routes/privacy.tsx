import { Button } from "@/components/ui/button";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Menu } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
});

function Privacy() {
  const { navigate } = useRouter();
  const [activeSection, setActiveSection] = useState("");
  const [isMobileTocOpen, setIsMobileTocOpen] = useState(false);

  const sections = [
    { id: "introduction", title: "Introduction" },
    {
      id: "personal-information-we-collect",
      title: "Personal Information We Collect",
    },
    {
      id: "information-we-do-not-collect",
      title: "Information We Do Not Collect",
    },
    {
      id: "how-we-use-information",
      title: "How We Use Your Personal Information",
    },
    { id: "sharing-information", title: "Sharing Your Personal Information" },
    { id: "do-not-track", title: "Do Not Track" },
    { id: "your-rights", title: "Your Rights" },
    { id: "data-retention", title: "Data Retention" },
    { id: "contact", title: "Contact Us" },
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
          Privacy Policy
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
              {/* Introduction */}
              <section id="introduction" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Introduction
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  We at TabbyML, Inc. ("TabbyML", "we" or "us") are strongly
                  committed to respecting your privacy and keeping secure any
                  information you share with us. This Privacy Policy ("Privacy
                  Policy") describes how your personal information is collected,
                  used, and shared when you visit getpochi.com (the "Site") or
                  use Pochi ("Service"), our full‑stack AI agent.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Please note that this Privacy Policy is not a contract and
                  does not create any legal rights or obligations not otherwise
                  provided by law.
                </p>
              </section>

              {/* Personal Information We Collect */}
              <section
                id="personal-information-we-collect"
                className="space-y-4"
              >
                <h2 className="font-semibold text-foreground text-xl">
                  Personal Information We Collect
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  We collect personal data if you create an account to use Pochi
                  or communicate with us. This includes:
                </p>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-foreground text-lg">
                      Account Information
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Including your name and email address, when you sign up to
                      receive information about our Service.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium text-foreground text-lg">
                      Payment Information
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Including payment card information, billing address, usage
                      credits, and other financial information (such as, routing
                      and account number). Please note that we use third-party
                      payment processing providers, including Stripe, to process
                      payments made to us. We do not retain any personally
                      identifiable financial information, such as payment card
                      number, you provide these third-party payment processing
                      providers in connection with payments. Rather, all such
                      information is provided directly by you to our third-party
                      payment processing providers.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium text-foreground text-lg">
                      Inputs and Suggestions
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      When using Pochi (hosted or self-hosted with
                      connectivity), we collect content that you submit to the
                      agent ("Inputs"), which generates responses
                      ("Suggestions") based on your Inputs. If you include
                      personal data or reference external content in your
                      Inputs, we will collect that information and it may be
                      reproduced in the Suggestions we provide.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium text-foreground text-lg">
                      Communication Information
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      If you communicate with us, we collect your name, contact
                      information, and the contents of any messages you send.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium text-foreground text-lg">
                      Feedback and Communication Information
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Including the feedback (such as ideas and suggestions for
                      product improvement) and contents of custom messages sent
                      to us through forms, chat platforms, emails, or other
                      contact information we make available to customers. We use
                      this information primarily to investigate and respond to
                      your inquiries, to communicate with you, and to improve
                      our products and services.
                    </p>
                  </div>
                </div>

                <p className="text-muted-foreground leading-relaxed">
                  When you use our website or the Pochi service, we also receive
                  certain technical data automatically. This includes:
                </p>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-foreground text-lg">
                      Device Information
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Your device or browser automatically sends us information
                      about when and how you install, access, or use our
                      services. This information may include your device type,
                      browser information, operating system information, and
                      mobile network or ISP. This information may depend on your
                      settings and the type of device you use to access the
                      services.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium text-foreground text-lg">
                      Log Information
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We collect information about how our services are
                      performing, including your IP address, browser type and
                      settings, error logs, and other ways that you interact
                      with the services.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium text-foreground text-lg">
                      Usage Data
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We collect information about your use of the services,
                      such as the dates and times of access, browsing history,
                      search, information about the links you click, pages you
                      view, and other information about how you use the
                      services, and technology on the devices you use to access
                      the services.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium text-foreground text-lg">
                      Cookies & Similar Technologies
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We and our service providers utilize cookies, pixels,
                      scripts, or similar technologies to operate and manage the
                      services and improve your experience. These technologies
                      help us to recognize you, customize or personalize your
                      experience, market additional products or services to you,
                      and analyze and optimize your use of the services, for
                      example to help maintain your preferences.
                    </p>
                  </div>

                  <div>
                    <h3 className="font-medium text-foreground text-lg">
                      Location Information
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      For security and performance reasons, for example to
                      detect unusual login activity or provide more useful
                      Suggestions, we may determine the geographic location from
                      which your device accesses our services using information
                      such as your IP address.
                    </p>
                  </div>
                </div>
              </section>

              {/* Information We Do Not Collect */}
              <section id="information-we-do-not-collect" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Information We Do Not Collect
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  We do not knowingly collect sensitive or special category
                  personal information, such as genetic data, biometric data for
                  the purposes of uniquely identifying a natural person, health
                  information, or religious information. Additionally, we do not
                  knowingly collect information from or direct any of our
                  services or content to children under the age of 18. If we
                  learn or have reason to suspect that a user is under the age
                  of 18, we will investigate and, if appropriate, delete the
                  personal data and/or the account.
                </p>
              </section>

              {/* How We Use Your Personal Information */}
              <section id="how-we-use-information" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  How We Use Your Personal Information
                </h2>
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    We use:
                  </p>
                  <ul className="list-disc space-y-2 pl-6 text-muted-foreground leading-relaxed">
                    <li>
                      Order Info: for purchase processing, communications, fraud
                      detection, marketing notice
                    </li>
                    <li>
                      Device Info: for site security, analytics, advertising
                      effectiveness
                    </li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed">
                    We also use Pochi interaction data to:
                  </p>
                  <ul className="list-disc space-y-2 pl-6 text-muted-foreground leading-relaxed">
                    <li>
                      Improve overall product performance and contextual
                      relevance
                    </li>
                    <li>Diagnose and resolve agent errors</li>
                    <li>Monitor automated actions for safe operation</li>
                    <li>Analyze aggregated usage patterns</li>
                  </ul>
                </div>
              </section>

              {/* Sharing Your Personal Information */}
              <section id="sharing-information" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Sharing Your Personal Information
                </h2>
                <div className="space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    We share personal data with third-party services (e.g.,
                    PostHog) for analytics and compliance.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    When you enable integrations (e.g., GitHub, CLI, CI/CD):
                  </p>
                  <ul className="list-disc space-y-2 pl-6 text-muted-foreground leading-relaxed">
                    <li>
                      We may store prompts or responses related to those
                      services
                    </li>
                    <li>
                      We don't share this data unless required by the integrated
                      services' terms or law
                    </li>
                    <li>
                      You remain responsible for reviewing third-party privacy
                      policies
                    </li>
                  </ul>
                </div>
              </section>

              {/* Do Not Track */}
              <section id="do-not-track" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Do Not Track
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Please note that we do not alter our Site's data collection
                  and use practices when we see a Do Not Track signal from your
                  browser.
                </p>
              </section>

              {/* Your Rights */}
              <section id="your-rights" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Your Rights
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you are a European resident, you have the right to access
                  personal information we hold about you and to ask that your
                  personal information be corrected, updated, or deleted. If you
                  would like to exercise this right, please contact us through
                  the contact information below. Additionally, if you are a
                  European resident we note that we are processing your
                  information in order to fulfill contracts we might have with
                  you (for example if you make an order through the Site), or
                  otherwise to pursue our legitimate business interests listed
                  above. Additionally, please note that your information will be
                  transferred outside of Europe, including to the United States
                  and China.
                </p>
              </section>

              {/* Data Retention */}
              <section id="data-retention" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Data Retention
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  When you place an order through the Site, we will maintain
                  your Order Information for our records unless and until you
                  ask us to delete this information.
                </p>
              </section>

              {/* Contact Information */}
              <section id="contact" className="space-y-4">
                <h2 className="font-semibold text-foreground text-xl">
                  Contact Us
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this policy and will notify users of significant
                  changes getpochi.com
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  For any privacy inquiries - including about Pochi data -
                  please get in touch with us at support@getpochi.com.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
