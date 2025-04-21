import { KV } from "./kv";
import { localStorage, useLocalStorage } from "./local";

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

export const useLocalToken = () => {
  const [token, setToken] = useLocalStorage("bearer_token", "");
  return [token, setToken] as const;
};

export const getLocalToken = () => {
  return JSON.parse(localStorage.getItem("bearer_token") || "null");
};

export const setLocalToken = (token: string | null) => {
  localStorage.setItem("bearer_token", JSON.stringify(token));
};
