import { useSettingsStore } from "../../store";
import { AccordionSection } from "../ui/accordion-section";
import { SettingsCheckboxOption } from "../ui/settings-checkbox-option";

export const AdvancedSettingsSection: React.FC = () => {
  const {
    isDevMode,
    updateIsDevMode,
    allowEditTodos,
    updateAllowEditTodos,
    enableNewTask,
    updateEnableNewTask,
    enableGeminiCustomToolCalls,
    updateEnableGeminiCustomToolCalls,
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
        <SettingsCheckboxOption
          id="allow-edit-todos"
          label="Allow Edit Todos"
          checked={allowEditTodos}
          onCheckedChange={(checked) => {
            updateAllowEditTodos(!!checked);
          }}
        />
        {isDevMode && (
          <>
            <SettingsCheckboxOption
              id="enable-gemini-custom-tool-calls"
              label="Enable Gemini Custom Tool Calls"
              checked={enableGeminiCustomToolCalls}
              onCheckedChange={(checked) => {
                updateEnableGeminiCustomToolCalls(!!checked);
              }}
            />
            <SettingsCheckboxOption
              id="enable-tool-new-task"
              label="Enable Tool: newTask"
              checked={!!enableNewTask}
              onCheckedChange={(checked) => {
                updateEnableNewTask(!!checked);
              }}
            />
          </>
        )}
      </div>
    </AccordionSection>
  );
};
