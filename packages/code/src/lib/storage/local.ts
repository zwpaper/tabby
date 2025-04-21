import { deepEquals } from "bun";
import { useCallback, useEffect, useState } from "react";
import { KV } from "./kv";

export const localStorage = new KV("local");

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      if (deepEquals(valueToStore, storedValue)) return;
      setStoredValue(valueToStore);
      localStorage.setItem(key, JSON.stringify(valueToStore));
    },
    [key, storedValue],
  );

  useEffect(() => {
    const watchCb = (x: string) => {
      const value = JSON.parse(x);
      if (deepEquals(value, storedValue)) return;
      setStoredValue(value);
    };
    localStorage.watchItem(key, watchCb);

    return () => {
      localStorage.unwatchItem(key, watchCb);
    };
  }, [key, storedValue]);

  return [storedValue, setValue] as const;
}
