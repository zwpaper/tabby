import { Button } from "@/components/ui/button";
import {
  BarChartIcon,
  BoxesIcon,
  CalculatorIcon,
  FileSignatureIcon,
  ImageIcon,
  LayoutDashboardIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import scene3DPrompt from "./prompts/3d-scene.md";
import calculatorPrompt from "./prompts/calculator.md";
import dataDashboardPrompt from "./prompts/data-dashboard.md";
import landingPagePrompt from "./prompts/landing-page.md";
import signUpFormPrompt from "./prompts/sign-up-form.md";

interface PromptSuggestionsProps {
  hasSelectImage: boolean;
  handleSelectImage: () => void;
  handleSubmit: (input: string, name: string) => void;
}

export function PromptSuggestions({
  hasSelectImage,
  handleSelectImage,
  handleSubmit,
}: PromptSuggestionsProps) {
  const [waitingForImageSelect, setWaitingForImageSelect] = useState(false);
  useEffect(() => {
    if (hasSelectImage && waitingForImageSelect) {
      setWaitingForImageSelect(false);
      setTimeout(() => {
        handleSubmit(
          "Please recreate the UI shown in the attached screenshot as accurately as possible.",
          "clone-a-screenshot",
        );
      }, 500);
    }
  }, [handleSubmit, hasSelectImage, waitingForImageSelect]);

  const handleSuggestionClick = async (prompt: string, name: string) => {
    if (name === "clone-a-screenshot") {
      setWaitingForImageSelect(true);
      handleSelectImage();
      return;
    }
    handleSubmit(prompt, name);
  };

  return (
    <div className="my-3">
      <div className="flex flex-wrap justify-center gap-3">
        {suggestions
          .filter((suggestion) => !suggestion.disabled)
          .map((suggestion) => (
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
    name: "clone-a-screenshot",
    label: "Clone a Screenshot",
    icon: <ImageIcon className="mr-2 h-4 w-4" />,
    prompt: "",
  },
  {
    name: "calculator",
    label: "Calculator",
    icon: <CalculatorIcon className="mr-2 h-4 w-4" />,
    prompt: calculatorPrompt,
    disabled: true,
  },
  {
    name: "explore-3d-forest",
    label: "Exploration 3D Forest",
    icon: <BoxesIcon className="mr-2 h-4 w-4" />,
    prompt: scene3DPrompt,
  },
  {
    name: "data-dashboard",
    label: "Data Dashboard",
    icon: <BarChartIcon className="mr-2 h-4 w-4" />,
    prompt: dataDashboardPrompt,
    disabled: true,
  },
];
