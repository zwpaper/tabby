import { LegalPage } from "@/components/legal-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/term-of-service")({
  component: Terms,
});

function Terms() {
  const sections = [
    { id: "access-license", title: "Access and License" },
    { id: "your-content", title: "Your Content" },
    { id: "service-ownership", title: "Service Ownership" },
    { id: "feedback-input", title: "Feedback and Input" },
    { id: "operational-data", title: "Operational and Technical Data" },
    { id: "privacy", title: "Privacy" },
    { id: "confidentiality", title: "Confidentiality" },
    { id: "term-access-limits", title: "Term and Access Limits" },
    { id: "disclaimer-warranties", title: "Disclaimer of Warranties" },
    { id: "limitation-liability", title: "Limitation of Liability" },
    {
      id: "responsibility-indemnity",
      title: "Your Responsibility and Indemnity",
    },
    { id: "changes-terms", title: "Changes to Terms" },
    { id: "legal-terms", title: "Legal Terms" },
    { id: "contact-information", title: "Contact Information and Disclosures" },
  ];

  return (
    <LegalPage
      title="Pochi – Research Preview Terms of Use"
      lastModified="Last Modified: 2025 / 06 / 26"
      sections={sections}
    >
      {/* Introduction */}
      <div className="space-y-4">
        <p className="text-muted-foreground leading-relaxed">
          By selecting "I Accept," installing, accessing, or using Pochi (the
          "Service"), you agree to these terms ("Agreement"). This research
          preview is provided by TabbyML, Inc. ("TabbyML," "we," "us," or
          "our"), but applies solely to your use of Pochi and not to any other
          TabbyML product unless explicitly stated.
        </p>
      </div>

      {/* 1. Access and License */}
      <section id="access-license" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          1. Access and License
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          We grant you a limited, non-exclusive, revocable, and non-transferable
          right to use the Service solely for personal or internal evaluation
          purposes during the research preview period. This license does not
          extend to production or commercial use unless otherwise authorized in
          writing.
        </p>
      </section>

      {/* 2. Your Content */}
      <section id="your-content" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          2. Your Content
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          You retain full ownership of any materials you submit to or generate
          with the Service, including prompts, source code, outputs, or other
          data ("User Content"). You allow us to access and process this content
          only as needed to operate, support, or improve the Service. Unless
          explicitly agreed, your User Content will not be used to train models.
          In specific testing modes, prompts and results may be processed
          transiently and not stored ("no retention").
        </p>
      </section>

      {/* 3. Service Ownership */}
      <section id="service-ownership" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          3. Service Ownership
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Pochi, including its underlying models, infrastructure, and
          interfaces, remains our intellectual property. Nothing in this
          Agreement transfers ownership or broader rights to the Service. You
          own your User Content, but not the system, model weights, or any
          non-user-generated outputs unless expressly permitted.
        </p>
      </section>

      {/* 4. Feedback and Input */}
      <section id="feedback-input" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          4. Feedback and Input
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          If you provide us with feedback, ideas, or technical suggestions about
          the Service, you agree that we may use them freely without
          compensation or obligation. Contributions like these help improve
          Pochi over time.
        </p>
      </section>

      {/* 5. Operational and Technical Data */}
      <section id="operational-data" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          5. Operational and Technical Data
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          We may collect anonymized or aggregated data about how Pochi is used
          (excluding the contents of your inputs or outputs) to help improve
          reliability and performance. Examples include runtime metrics, error
          logs, and interface usage statistics.
        </p>
      </section>

      {/* 6. Privacy */}
      <section id="privacy" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">6. Privacy</h2>
        <p className="text-muted-foreground leading-relaxed">
          Any data submitted through the Service is handled according to our{" "}
          <a
            href="https://www.getpochi.com/privacy-policy"
            className="text-primary underline hover:text-primary/80"
          >
            Privacy Policy
          </a>
          . You're responsible for ensuring that your use of Pochi complies with
          applicable data protection laws.
        </p>
      </section>

      {/* 7. Confidentiality */}
      <section id="confidentiality" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          7. Confidentiality
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Any non-public information exchanged between you and us related to
          this preview - such as technical details or unreleased features -
          should be treated as confidential unless (a) it's already public, (b)
          independently developed, or (c) lawfully obtained from another source.
          Both parties agree to protect such information using reasonable care
          and to use it only in connection with this Agreement.
        </p>
      </section>

      {/* 8. Term and Access Limits */}
      <section id="term-access-limits" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          8. Term and Access Limits
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Unless otherwise arranged in writing, use of the Service during the
          research preview is free of charge and may be limited in
          functionality, duration, or usage volume. This Agreement is effective
          as long as you use the Service or until we end the preview, whichever
          comes first. We reserve the right to introduce credits, quotas, or
          fees for extended access.
        </p>
      </section>

      {/* 9. Disclaimer of Warranties */}
      <section id="disclaimer-warranties" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          9. Disclaimer of Warranties
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          The Service is provided "as is" for experimental and feedback
          purposes. We make no warranties - express or implied - about accuracy,
          performance, or suitability for any particular task. We do not
          guarantee uninterrupted access, and Pochi may evolve or change without
          notice.
        </p>
      </section>

      {/* 10. Limitation of Liability */}
      <section id="limitation-liability" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          10. Limitation of Liability
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          To the fullest extent permitted by law, we won't be liable for any
          indirect, incidental, special, or consequential damages, including
          lost profits or data.
        </p>
      </section>

      {/* 11. Your Responsibility and Indemnity */}
      <section id="responsibility-indemnity" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          11. Your Responsibility and Indemnity
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          You are solely responsible for how you use the Service and the content
          you submit. If your use causes harm or legal issues for others or us -
          such as infringing someone else's rights - you agree to defend and
          indemnify us to the extent allowed by law.
        </p>
      </section>

      {/* 12. Changes to Terms */}
      <section id="changes-terms" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          12. Changes to Terms
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          We may update these terms at any time. If changes are material, we'll
          make an effort to notify you. Your continued use of the Service after
          any changes are posted means you accept the updated terms.
        </p>
      </section>

      {/* 13. Legal Terms */}
      <section id="legal-terms" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          13. Legal Terms
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-foreground text-lg">
              Governing Law
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              This Agreement is governed by the laws of Delaware, regardless of
              any conflict-of-law rules.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground text-lg">
              Dispute Resolution
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              If a dispute arises, please contact us at support@getpochi.com to
              attempt a good-faith resolution. If no agreement is reached
              through negotiation, each party agrees to submit to the exclusive
              jurisdiction of, and venue in, the courts in the State of Delaware
              in any dispute arising out of or relating to this Agreement.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground text-lg">
              Waiver and Severability
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              If we don't enforce a part of this Agreement, it doesn't mean we
              waive the right to do so in the future. If any section is found
              unenforceable, the rest remains valid.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground text-lg">Assignment</h3>
            <p className="text-muted-foreground leading-relaxed">
              Neither party may transfer this Agreement without written consent,
              except in connection with a merger, acquisition, or similar
              restructuring.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground text-lg">Survival</h3>
            <p className="text-muted-foreground leading-relaxed">
              Terms covering ownership, feedback, confidentiality, and liability
              survive even after the Agreement ends.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-foreground text-lg">
              Entire Agreement
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              This document constitutes the full understanding between you and
              us regarding Pochi's research preview and overrides any prior
              agreements or understandings.
            </p>
          </div>
        </div>
      </section>

      {/* 14. Contact Information and Disclosures */}
      <section id="contact-information" className="space-y-4">
        <h2 className="font-semibold text-foreground text-xl">
          14. Contact Information and Disclosures
        </h2>
        <div className="space-y-2">
          <p className="text-muted-foreground leading-relaxed">
            The Service is provided by:
          </p>
          <p className="text-muted-foreground leading-relaxed">
            <strong>TabbyML, Inc.</strong>
            <br />
            Email: support@getpochi.com
          </p>
        </div>
      </section>
    </LegalPage>
  );
}
