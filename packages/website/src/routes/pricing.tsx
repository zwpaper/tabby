import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Terminal } from "lucide-react";

const modelPricingData = [
  {
    id: "google/gemini-2.5-pro",
    contextWindow: 1_048_576,
    costType: "Super",
    name: "Gemini 2.5 Pro",
    pricing: {
      input: 12,
      output: 100,
      cacheRead: 3,
      inputAbove200k: 25,
      outputAbove200k: 150,
      cacheReadAbove200k: 6,
    },
  },
  {
    id: "anthropic/claude-4-sonnet",
    contextWindow: 200_000,
    costType: "Super",
    name: "Claude 4 Sonnet",
    pricing: {
      input: 30,
      output: 150,
      cacheRead: 3,
      cacheWrite: 37,
    },
  },
  {
    id: "zai/glm-4.5",
    contextWindow: 131_072,
    costType: "Swift",
    name: "GLM 4.5",
    pricing: {
      input: 5,
      output: 20,
    },
  },
  {
    id: "moonshotai/kimi-k2",
    contextWindow: 131_072,
    costType: "Swift",
    name: "Kimi K2",
    pricing: {
      input: 10,
      output: 30,
    },
  },
  {
    id: "qwen/qwen3-coder",
    contextWindow: 262_144,
    costType: "Swift",
    name: "Qwen3 Coder",
    pricing: {
      input: 4,
      output: 16,
    },
  },
  {
    id: "google/gemini-2.5-flash",
    contextWindow: 1_048_576,
    costType: "Swift",
    name: "Gemini 2.5 Flash",
    pricing: {
      input: 3,
      output: 25,
      cacheRead: 1,
    },
  },
];

export const Route = createFileRoute("/pricing")({
  component: ThemeWrapped,
});

function ThemeWrapped() {
  return (
    <ThemeProvider storageKey="pochi-share-theme" defaultTheme="light">
      <RouteComponent />
    </ThemeProvider>
  );
}

function RouteComponent() {
  const formatPrice = (credits: number) => {
    const usdPer1M = credits / 10;
    return `$${usdPer1M.toFixed(1)}`;
  };

  const formatContextWindow = (tokens: number) => {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(1).replace(".0", "")}M`;
    }
    if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1).replace(".0", "")}K`;
    }
    return tokens.toString();
  };

  const groupedModels = modelPricingData.reduce(
    (acc, model) => {
      const { costType } = model;
      if (!acc[costType]) {
        acc[costType] = [];
      }
      acc[costType].push(model);
      return acc;
    },
    {} as Record<string, typeof modelPricingData>,
  );

  return (
    <div className="-mb-16 min-h-screen">
      <div className="mx-auto max-w-5xl px-6 pt-4 pb-16">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-1.5">
            <Terminal className="!size-5 animate-[spin_6s_linear_infinite]" />
            <span className="font-semibold text-base">Pochi</span>
          </Link>
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
        </div>
        <div className="mt-16 text-center">
          <h1 className="mb-6 pb-4 font-bold text-3xl lg:text-4xl">Pricing</h1>
        </div>

        {/* Pricing Table */}
        <div className="mt-24">
          {Object.entries(groupedModels).map(([costType, models]) => (
            <div key={costType} className="mb-8">
              <h2 className="mb-6 font-bold text-gray-800 text-xl dark:text-gray-200">
                {costType}
              </h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Model</TableHead>
                    <TableHead className="min-w-[200px]">
                      Context Window
                    </TableHead>
                    <TableHead className="min-w-[250px]">
                      Input / 1M tokens
                    </TableHead>
                    <TableHead className="min-w-[250px]">
                      Output / 1M tokens
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell className="font-medium">
                        {model.name}
                      </TableCell>
                      <TableCell>
                        {formatContextWindow(model.contextWindow)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <div>
                            <span className="font-semibold">
                              {formatPrice(model.pricing.input)}
                            </span>
                            {model.pricing.cacheRead && (
                              <span className="text-gray-600 dark:text-gray-400">
                                {" "}
                                / {formatPrice(model.pricing.cacheRead)} (Cache
                                Read)
                              </span>
                            )}
                          </div>
                          {model.pricing.inputAbove200k && (
                            <div className="text-xs">
                              <div className="flex items-center gap-1">
                                <div className="flex shrink-0 items-center gap-1">
                                  <span>&gt; 200K tokens:</span>
                                </div>
                                <div>
                                  <span className="font-semibold">
                                    {formatPrice(model.pricing.inputAbove200k)}
                                  </span>
                                  {model.pricing.cacheReadAbove200k && (
                                    <span className="text-gray-600 dark:text-gray-400">
                                      {" "}
                                      /{" "}
                                      {formatPrice(
                                        model.pricing.cacheReadAbove200k,
                                      )}{" "}
                                      (Cache Read)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <div>
                            <span className="font-semibold">
                              {formatPrice(model.pricing.output)}
                            </span>
                            {model.pricing.cacheWrite && (
                              <span className="text-gray-600 dark:text-gray-400">
                                {" "}
                                + {formatPrice(model.pricing.cacheWrite)} (Cache
                                Write)
                              </span>
                            )}
                          </div>
                          {model.pricing.outputAbove200k && (
                            <div className="text-xs">
                              <div className="flex items-center gap-1">
                                <div className="flex shrink-0 items-center gap-1">
                                  <span>&gt; 200K tokens:</span>
                                </div>
                                <div>
                                  <span className="font-semibold">
                                    {formatPrice(
                                      model.pricing.outputAbove200k || 0,
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
