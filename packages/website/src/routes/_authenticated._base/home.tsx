import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/_base/home")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="container mx-auto flex max-h-[1080px] max-w-7xl flex-1 items-start px-4 pt-16 sm:px-6 lg:items-center lg:px-8 lg:pt-0">
      <div className="space-y-8 pb-4">
        <div className="space-y-4 text-center">
          <h1 className="font-bold text-3xl text-foreground tracking-tight">
            Get Started with Pochi
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Onboard your Pochi teammate on your existing dev tools - Slack for
            team collaboration, and VSCode for hands-on coding
          </p>
        </div>
        <InstallPanel />
      </div>
    </div>
  );
}
const editors = [
  {
    name: "Slack",
    description:
      "Assign tasks to AI and get a fully remote agent running in the cloud. Jump into a cloud VSCode environment to take over when needed.",
    popularity: "Research Preview",
    setupTime: "5 minutes",
    icon: (
      <img
        src="https://a.slack-edge.com/fd21de4/marketing/img/nav/logo.svg"
        className="size-4"
        alt="Slack"
      />
    ),
    features: [
      "Assign coding tasks directly from Slack messages",
      "Fully autonomous AI agent runs in secure cloud environment",
      "Real-time progress updates and notifications in Slack",
      "Seamless handoff to cloud VSCode when AI needs help",
      "Complete task execution without local setup",
    ],
    capabilities: [
      "Natural language task assignment",
      "Cloud-based code execution and testing",
      "Automatic progress reporting",
      "Human takeover when needed",
      "Team collaboration and visibility",
    ],
    installLink: "/slack/installation",
    callToAction: "Add to Slack ↗",
  },
  {
    name: "VS Code",
    description:
      "A coding agent that lives in your sidebar, ready to help with any development task directly in your workspace.",
    popularity: "Research Preview",
    setupTime: "1 minute",
    icon: (
      <img
        src="https://code.visualstudio.com/assets/images/code-stable.png"
        className="size-4"
        alt="VS Code"
      />
    ),
    features: [
      "AI coding agent integrated in your sidebar",
      "Context-aware assistance with your current project",
      "Direct file editing and code generation",
      "Automated testing and debugging support",
      "Works with your existing VSCode workflow",
    ],
    capabilities: [
      "Understands your entire codebase",
      "Executes commands in your terminal",
      "Creates and modifies files directly",
      "Runs tests and builds automatically",
      "Provides real-time coding assistance",
    ],
    installLink:
      "https://marketplace.visualstudio.com/items?itemName=TabbyML.pochi",
    callToAction: "Install Now ↗",
  },
];

export function InstallPanel() {
  const [activeEditor, setActiveEditor] = useState(editors[0].name);
  const activeEditorData = editors.find((e) => e.name === activeEditor);

  return (
    <Card className="rounded-lg border shadow-sm">
      <CardContent className="min-h-150 p-0">
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-4">
          {/* Editor Selection Sidebar */}
          <div className="border-b lg:col-span-1 lg:border-r lg:border-b-0">
            <div className="p-6">
              <h3 className="mb-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide">
                Install
              </h3>
              <div className="space-y-2">
                {editors.map((editor) => (
                  <Button
                    key={editor.name}
                    variant={activeEditor === editor.name ? "accent" : "ghost"}
                    className="h-auto w-full justify-start gap-3 px-3 py-3"
                    onClick={() => setActiveEditor(editor.name)}
                  >
                    <div className="flex-shrink-0">{editor.icon}</div>
                    <div className="text-left">
                      <div className="font-medium">{editor.name}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="p-8">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {activeEditorData?.icon}
                      </div>
                      <h2 className="font-bold text-2xl">{activeEditor}</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                        {activeEditorData?.popularity}
                      </span>
                      <span className="text-muted-foreground">
                        Setup: {activeEditorData?.setupTime}
                      </span>
                    </div>
                  </div>
                  <a
                    className={cn(
                      buttonVariants({
                        size: "lg",
                        className: "px-8",
                      }),
                      "min-w-48",
                    )}
                    href={activeEditorData?.installLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {activeEditorData?.callToAction}
                  </a>
                </div>

                {/* Description */}
                <div className="space-y-4">
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {activeEditorData?.description}
                  </p>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 font-semibold text-foreground text-lg">
                      <svg
                        className="h-5 w-5 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <title>Capabilities gear icon</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      Key Capabilities
                    </h3>
                    <ul className="space-y-3">
                      {activeEditorData?.capabilities.map(
                        (capability, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-3 text-muted-foreground"
                          >
                            <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground/60" />
                            <span className="leading-relaxed">
                              {capability}
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <h3 className="flex items-center gap-2 font-semibold text-foreground text-lg">
                      <svg
                        className="h-5 w-5 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <title>Features lightning bolt icon</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      What you'll get
                    </h3>
                    <ul className="space-y-3">
                      {activeEditorData?.features.map((feature, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 text-muted-foreground"
                        >
                          <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                          <span className="leading-relaxed">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
