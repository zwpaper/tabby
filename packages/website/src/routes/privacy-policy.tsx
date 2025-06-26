import { LegalPage } from "@/components/legal-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy-policy")({
  component: Privacy,
});

function Privacy() {
  const sections = [
    { id: "introduction", title: "Introduction" },
    {
      id: "personal-information-we-collect",
      title: "Personal Information We Collect",
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

  return (
    <LegalPage
      title="Privacy Policy"
      lastModified="Last Modified: 2025 / 06 / 26"
      sections={sections}
    >
      {/* Introduction */}
      <section id="introduction" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">Introduction</h2>
        <p className="text-muted-foreground leading-relaxed">
          We at TabbyML, Inc. ("TabbyML", "we" or "us") are strongly committed
          to respecting your privacy and keeping secure any information you
          share with us. This Privacy Policy ("Privacy Policy") describes how
          your personal information is collected, used, and shared when you
          visit getpochi.com (the "Site") or use Pochi ("Service"), our
          full‑stack AI agent.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Please note that this Privacy Policy is not a contract and does not
          create any legal rights or obligations not otherwise provided by law.
        </p>
      </section>

      {/* Personal Information We Collect */}
      <section id="personal-information-we-collect" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          Personal Information We Collect
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          When you visit the Site or use the Service, we automatically collect
          certain information about your device, including information about
          your web browser, IP address, time zone, and some of the cookies that
          are installed on your device. Additionally, as you browse the Site or
          use the Service, we collect information about the individual web pages
          or features that you view, what websites or search terms referred you
          to the Site, and information about how you interact with the Site or
          Service. We refer to this automatically-collected information as
          "Device Information."
        </p>

        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-foreground text-lg">
              We collect Device Information using the following technologies:
            </h3>
            <ul className="ml-6 list-disc space-y-2 text-muted-foreground leading-relaxed">
              <li>
                "Cookies" are data files that are placed on your device or
                computer and often include an anonymous unique identifier. For
                more information about cookies, and how to disable cookies,
                visit http://www.allaboutcookies.org.
              </li>
              <li>
                "Log files" track actions occurring on the Site, and collect
                data including your IP address, browser type, Internet service
                provider, referring/exit pages, and date/time stamps.
              </li>
              <li>
                "Web beacons," "tags," and "pixels" are electronic files used to
                record information about how you browse the Site.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium text-foreground text-lg">
              Additionally when you make a purchase or attempt to make a
              purchase through the Site, we collect certain information from
              you, including:
            </h3>
            <ul className="ml-6 list-disc space-y-2 text-muted-foreground leading-relaxed">
              <li>
                Including your name and email address, when you sign up to use
                the Service or create an account
              </li>
              <li>
                Billing address, payment information (including credit card
                numbers), when you make a purchase
              </li>
              <li>Phone number, when you provide it to us</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              We refer to this information as "Order Information."
            </p>
          </div>

          <p className="text-muted-foreground leading-relaxed">
            When we talk about "Personal Information" in this Privacy Policy, we
            are talking both about Device Information and Order Information.
          </p>
        </div>
      </section>

      {/* How We Use Your Personal Information */}
      <section id="how-we-use-information" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          How We Use Your Personal Information
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          We use the Order Information that we collect generally to fulfill any
          orders placed through the Site (including processing your payment
          information, arranging for shipping, and providing you with invoices
          and/or order confirmations). Additionally, we use this Order
          Information to:
        </p>
        <ul className="ml-6 list-disc space-y-2 text-muted-foreground leading-relaxed">
          <li>Communicate with you;</li>
          <li>Screen our orders for potential risk or fraud; and</li>
          <li>
            When in line with the preferences you have shared with us, provide
            you with information or advertising relating to our products or
            services.
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed">
          We use the Device Information that we collect to help us screen for
          potential risk and fraud (in particular, your IP address), and more
          generally to improve and optimize our Site and Service (for example,
          by generating analytics about how our customers browse and interact
          with the Site, and to assess the success of our marketing and
          advertising campaigns).
        </p>
      </section>

      {/* Sharing Your Personal Information */}
      <section id="sharing-information" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          Sharing Your Personal Information
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          We share your Personal Information with third parties to help us use
          your Personal Information, as described above. For example, we use
          Stripe to power our online store--you can read more about how Stripe
          uses your Personal Information here: https://stripe.com/privacy. We
          also use Google Analytics to help us understand how our customers use
          the Site--you can read more about how Google uses your Personal
          Information here: https://www.google.com/intl/en/policies/privacy/.
          You can also opt-out of Google Analytics here:
          https://tools.google.com/dlpage/gaoptout.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Finally, we may also share your Personal Information to comply with
          applicable laws and regulations, to respond to a subpoena, search
          warrant or other lawful request for information we receive, or to
          otherwise protect our rights.
        </p>
      </section>

      {/* Do Not Track */}
      <section id="do-not-track" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">Do Not Track</h2>
        <p className="text-muted-foreground leading-relaxed">
          Please note that we do not alter our Site's data collection and use
          practices when we see a Do Not Track signal from your browser.
        </p>
      </section>

      {/* Your Rights */}
      <section id="your-rights" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">Your Rights</h2>
        <p className="text-muted-foreground leading-relaxed">
          If you are a European resident, you have the right to access personal
          information we hold about you and to ask that your personal
          information be corrected, updated, or deleted. If you would like to
          exercise this right, please contact us through the contact information
          below.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Additionally, if you are a European resident we note that we are
          processing your information in order to fulfill contracts we might
          have with you (for example if you make an order through the Site), or
          otherwise to pursue our legitimate business interests listed above.
          Additionally, please note that your information will be transferred
          outside of Europe, including to Canada and the United States.
        </p>
      </section>

      {/* Data Retention */}
      <section id="data-retention" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          Data Retention
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          When you place an order through the Site, we will maintain your Order
          Information for our records unless and until you ask us to delete this
          information.
        </p>
      </section>

      {/* Contact Us */}
      <section id="contact" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">Contact Us</h2>
        <p className="text-muted-foreground leading-relaxed">
          For more information about our privacy practices, if you have
          questions, or if you would like to make a complaint, please contact us
          by e-mail at support@getpochi.com.
        </p>
      </section>
    </LegalPage>
  );
}
