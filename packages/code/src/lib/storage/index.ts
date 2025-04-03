import { KV } from "./kv";
import { useLocalStorage } from "./local";

export const authStorage = new KV("auth");

export const useLocalSettings = () => {
  const [settings, setSettings] = useLocalStorage("settings", {
    model: "openai/gpt-4o-mini",
  });

  const updateSettings = (x: Partial<typeof settings>) => {
    setSettings((prev) => ({
      ...prev,
      ...x,
    }));
  };

  return [settings, updateSettings] as const;
};
