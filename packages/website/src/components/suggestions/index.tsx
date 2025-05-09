import { Button } from "@/components/ui/button";
import {
  CalculatorIcon,
  FileSignatureIcon,
  LayoutDashboardIcon,
} from "lucide-react";
import calculatorPrompt from "./prompts/calculator.md";
import landingPagePrompt from "./prompts/landing-page.md";
import signUpFormPrompt from "./prompts/sign-up-form.md";

interface PromptSuggestionsProps {
  handleSubmit: (input: string, name: string) => void;
}

export function PromptSuggestions({ handleSubmit }: PromptSuggestionsProps) {
  const handleSuggestionClick = (prompt: string, name: string) => {
    handleSubmit(prompt, name);
  };

  const suggestions = [
    {
      name: "landing-page",
      label: "Landing Page",
      icon: <LayoutDashboardIcon className="mr-2 h-4 w-4" />,
      prompt: landingPagePrompt,
    },
    {
      name: "sign-up-form",
      label: "Sign Up Form",
      icon: <FileSignatureIcon className="mr-2 h-4 w-4" />,
      prompt: signUpFormPrompt,
    },
    {
      name: "calculator",
      label: "Calculator",
      icon: <CalculatorIcon className="mr-2 h-4 w-4" />,
      prompt: calculatorPrompt,
    },
  ];

  return (
    <div className="my-3">
      <div className="flex flex-wrap justify-center gap-3">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion.name}
            variant="outline"
            onClick={() =>
              handleSuggestionClick(suggestion.prompt, suggestion.name)
            }
            className="rounded-xl border border-gray-200 bg-white/80 py-2 shadow-md backdrop-blur-sm transition-all duration-300 ease-in-out hover:shadow-[0_0_2px_2px_theme(colors.cyan.400/0.5),_0_0_4px_3px_theme(colors.purple.500/0.5)] dark:border-gray-700 dark:hover:border-purple-400 dark:hover:shadow-[0_0_2px_2px_theme(colors.cyan.300/0.7),_0_0_4px_3px_theme(colors.purple.400/0.5)]"
          >
            {suggestion.icon}
            {suggestion.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
