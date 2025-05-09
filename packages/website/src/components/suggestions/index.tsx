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

  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      <Button
        variant="outline"
        onClick={() => handleSuggestionClick(landingPagePrompt, "landing-page")}
        className="bg-white/80 backdrop-blur-sm"
      >
        <LayoutDashboardIcon className="mr-2 h-4 w-4" />
        Landing Page
      </Button>
      <Button
        variant="outline"
        onClick={() => handleSuggestionClick(signUpFormPrompt, "sign-up-form")}
        className="bg-white/80 backdrop-blur-sm"
      >
        <FileSignatureIcon className="mr-2 h-4 w-4" />
        Sign Up Form
      </Button>
      <Button
        variant="outline"
        onClick={() => handleSuggestionClick(calculatorPrompt, "calculator")}
        className="bg-white/80 backdrop-blur-sm"
      >
        <CalculatorIcon className="mr-2 h-4 w-4" />
        Calculator
      </Button>
    </div>
  );
}
