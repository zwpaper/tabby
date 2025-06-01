import { useIsDevMode } from "@/lib/hooks/use-is-dev-mode";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { AccordionSection } from "./accordion-section";
import { SettingsCheckboxOption } from "./settings-checkbox-option";

export const AdvancedSettingsSection: React.FC = () => {
  const [isDevMode, setIsDevMode] = useIsDevMode();
  const { enableReasoning, updateEnableReasoning } = useSettingsStore();

  return (
    <AccordionSection title="Advanced Settings">
      <div className="flex flex-col gap-4 px-6">
        {isDevMode !== undefined && (
          <SettingsCheckboxOption
            id="dev-mode"
            label="Developer Mode"
            checked={isDevMode}
            onCheckedChange={(checked) => {
              setIsDevMode(!!checked);
            }}
          />
        )}
        <SettingsCheckboxOption
          id="enable-reasoning"
          label="Enable Reasoning"
          checked={enableReasoning}
          onCheckedChange={(checked) => {
            updateEnableReasoning(!!checked);
          }}
        />
      </div>
    </AccordionSection>
  );
};
