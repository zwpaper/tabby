import { useSettingsStore } from "../../store";
import { AccordionSection } from "../ui/accordion-section";
import { SettingsCheckboxOption } from "../ui/settings-checkbox-option";

export const AdvancedSettingsSection: React.FC = () => {
  const { isDevMode, updateIsDevMode, allowEditTodos, updateAllowEditTodos } =
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
          id="allow-edit-todos"
          label="Allow Edit Todos"
          checked={allowEditTodos}
          onCheckedChange={(checked) => {
            updateAllowEditTodos(!!checked);
          }}
        />
      </div>
    </AccordionSection>
  );
};
