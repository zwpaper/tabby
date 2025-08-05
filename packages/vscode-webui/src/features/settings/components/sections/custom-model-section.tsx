import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DotIcon } from "lucide-react";
import { useCustomModelSetting } from "../../hooks/use-custom-model-setting";
import { Section, SubSection } from "../ui/section";

export const CustomModelSection: React.FC = () => {
  const { customModelSettings, isLoading } = useCustomModelSetting();

  return (
    <Section title="Custom Models">
      <SubSection
        title={
          <div className="flex items-center gap-2">
            <a
              href="command:pochi.openCustomModelSettings"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className={buttonVariants({ variant: "secondary" })}>
                Edit Custom Models
              </Button>
            </a>
            <span className="text-muted-foreground text-sm">
              Manage your custom models.
            </span>
          </div>
        }
      >
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 1 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-secondary" />
            ))}
          </div>
        ) : (
          customModelSettings &&
          customModelSettings.length > 0 && (
            <div className="space-y-4">
              {customModelSettings.map((provider) => (
                <div key={provider.id}>
                  <div className="px-1 font-medium text-muted-foreground text-sm">
                    {provider.name ?? provider.id}
                  </div>
                  <div className="mt-1 space-y-2">
                    {provider.models.map((model) => (
                      <div
                        key={model.id}
                        className={cn("rounded-md border p-2")}
                      >
                        <div className="flex justify-between">
                          <div className="flex flex-1 items-center overflow-x-hidden">
                            <div className="flex size-6 shrink-0 items-center justify-center">
                              <DotIcon className="size-6 text-muted-foreground" />
                            </div>
                            <span className="truncate font-semibold">
                              {model.name ?? model.id}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </SubSection>
    </Section>
  );
};
