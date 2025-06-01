import { useSettingsStore } from "../../store";
import { AccordionSection } from "../ui/accordion-section";
import { SettingsCheckboxOption } from "../ui/settings-checkbox-option";

export const AdvancedSettingsSection: React.FC = () => {
  const { enableReasoning, updateEnableReasoning, isDevMode, updateIsDevMode } =
    useSettingsStore();

  return (
    <AccordionSection title="Advanced Settings">
      <div className="flex flex-col gap-4 px-6">
        {isDevMode !== undefined && (
          <SettingsCheckboxOption
            id="dev-mode"
            label="Developer Mode"
            checked={isDevMode}
            onCheckedChange={(checked) => {
              updateIsDevMode(!!checked);
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
