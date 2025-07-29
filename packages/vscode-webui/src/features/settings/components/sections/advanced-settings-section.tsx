import { useSettingsStore } from "../../store";
import { AccordionSection } from "../ui/accordion-section";
import { SettingsCheckboxOption } from "../ui/settings-checkbox-option";

export const AdvancedSettingsSection: React.FC = () => {
  const {
    isDevMode,
    updateIsDevMode,

    enablePochiModels,
    updateEnablePochiModels,
    enableAutoCompact,
    updateEnableAutoCompact,
  } = useSettingsStore();

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
        {isDevMode && (
          <SettingsCheckboxOption
            id="enable-pochi-models"
            label="Enable Pochi Models"
            checked={enablePochiModels}
            onCheckedChange={(checked) => {
              updateEnablePochiModels(!!checked);
            }}
          />
        )}
        {isDevMode && (
          <SettingsCheckboxOption
            id="enable-auto-compact"
            label="Enable Auto Compact"
            checked={enableAutoCompact}
            onCheckedChange={(checked) => {
              updateEnableAutoCompact(!!checked);
            }}
          />
        )}
      </div>
    </AccordionSection>
  );
};
