import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Info, Terminal } from "lucide-react";

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
    <div className="-mb-16 min-h-screen bg-gradient-to-br from-blue-50 via-white to-amber-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:50px_50px] opacity-60 dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)]" />

      <div className="absolute top-20 right-20 h-40 w-40 rounded-full bg-blue-200 blur-3xl dark:bg-blue-900/20" />
      <div className="absolute bottom-20 left-20 h-60 w-60 rounded-full bg-amber-200 blur-3xl dark:bg-amber-900/20" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-4 pb-16">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-1.5">
            <Terminal className="!size-5 animate-[spin_6s_linear_infinite]" />
            <span className="font-semibold text-base">Pochi</span>
          </Link>
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
        </div>
        <div className="mb-12 text-center">
          <h1 className="mb-6 bg-clip-text pb-4 font-bold text-3xl lg:text-4xl">
            Pricing
          </h1>
        </div>

        {/* Pricing Grid */}
        <div className="mb-16">
          {Object.entries(groupedModels).map(([costType, models]) => (
            <div key={costType} className="mb-8">
              <h2 className="mb-6 font-bold text-gray-800 text-xl dark:text-gray-200">
                {costType}
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {models.map((model) => (
                  <div key={model.id} className="relative">
                    <Card
                      className={cn(
                        "flex w-full flex-col rounded-sm py-2 transition-all duration-300 md:flex-row",
                        model.costType === "Super" &&
                          "bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10",
                      )}
                    >
                      <CardHeader className="my-auto flex-shrink-0 pb-4 md:w-2/5 md:border-r md:pb-6 md:dark:border-gray-800">
                        <CardTitle className="mt-8 flex justify-center text-md">
                          {model.name}
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="flex flex-grow flex-col justify-between space-y-6 p-6 md:w-2/3">
                        <div className="space-y-3">
                          <div className="space-y-2 rounded-lg">
                            {model.pricing.cacheRead ? (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">
                                  Input
                                </span>
                                <span className="font-semibold">
                                  {formatPrice(model.pricing.input)} /{" "}
                                  {formatPrice(model.pricing.cacheRead)} (Cache
                                  hits)
                                </span>
                              </div>
                            ) : (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">
                                  Input
                                </span>
                                <span className="font-semibold">
                                  {formatPrice(model.pricing.input)}
                                </span>
                              </div>
                            )}
                            {model.pricing.cacheWrite ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Output
                                  </span>
                                  <span className="font-semibold">
                                    {formatPrice(model.pricing.output)}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Cache writes
                                  </span>
                                  <span className="font-semibold">
                                    {formatPrice(model.pricing.cacheWrite)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">
                                  Output
                                </span>
                                <span className="font-semibold">
                                  {formatPrice(model.pricing.output)}
                                </span>
                              </div>
                            )}
                          </div>
                          {model.pricing.inputAbove200k && (
                            <div className="rounded-lg">
                              <div className="mb-2 flex items-center gap-1 font-medium text-purple-700 text-xs dark:text-purple-300">
                                <Info className="h-3 w-3" />
                                Above 200K tokens:
                              </div>
                              <div className="space-y-1">
                                {model.pricing.cacheReadAbove200k ? (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">
                                      Input
                                    </span>
                                    <span className="font-semibold">
                                      {formatPrice(
                                        model.pricing.inputAbove200k,
                                      )}{" "}
                                      /{" "}
                                      {formatPrice(
                                        model.pricing.cacheReadAbove200k,
                                      )}{" "}
                                      (Cache hits)
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">
                                      Input
                                    </span>
                                    <span className="font-semibold">
                                      {formatPrice(
                                        model.pricing.inputAbove200k,
                                      )}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Output
                                  </span>
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
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm dark:text-gray-400">
            Prices are listed per 1M tokens and are calculated based on actual
            token usage.
          </p>
        </div>
      </div>
      {/* <Footer /> */}
    </div>
  );
}
