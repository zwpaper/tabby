import LZString from "lz-string";
import { useCallback, useEffect, useRef, useState } from "react";

export const LocalStorageKey = "label-studio-tasks";

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  transform?: (value: T) => T,
  debounceMs = 500,
): [T, (value: T | ((prev: T) => T)) => void, () => void, boolean] {
  // Get initial value from localStorage or use initialValue
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const compressedItem = window.localStorage.getItem(key);
      if (compressedItem) {
        // Try to decompress the data
        const decompressed = LZString.decompress(compressedItem);
        if (decompressed) {
          const parsed = JSON.parse(decompressed) as T;
          const result = transform ? transform(parsed) : parsed;
          return result;
        }
        // Fallback: try to parse as uncompressed JSON (for backward compatibility)
        try {
          const parsed = JSON.parse(compressedItem) as T;
          const result = transform ? transform(parsed) : parsed;
          return result;
        } catch {
          // Data is corrupted, use initial value
          console.warn(
            `Corrupted data in localStorage for key "${key}", using initial value`,
          );
        }
      }
      return initialValue;
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      return initialValue;
    }
  });

  // Track if storage quota is exceeded
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);

  // Ref to store the debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if this is the initial load to avoid debouncing on first render
  const isInitialLoadRef = useRef(true);

  // Function to save to localStorage
  const saveToLocalStorage = useCallback(
    (value: T) => {
      try {
        const jsonString = JSON.stringify(value);
        const compressed = LZString.compress(jsonString);

        window.localStorage.setItem(key, compressed);
        setIsQuotaExceeded(false);
      } catch (error) {
        console.error(`Error saving ${key} to localStorage:`, error);
        // If compression fails or quota exceeded, set warning state
        if (
          error instanceof DOMException &&
          error.name === "QuotaExceededError"
        ) {
          setIsQuotaExceeded(true);
        }
      }
    },
    [key],
  );

  // Debounced save to localStorage whenever value changes
  useEffect(() => {
    // Skip saving on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for debounced save
    debounceTimerRef.current = setTimeout(() => {
      saveToLocalStorage(storedValue);
    }, debounceMs);

    // Cleanup timer on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [storedValue, debounceMs, saveToLocalStorage]);

  // Set value function that also triggers localStorage update
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setStoredValue(value);
  }, []);

  // Clear function to remove from localStorage and reset to initial value
  const clearStorage = useCallback(() => {
    try {
      // Clear any pending debounced save
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
      setIsQuotaExceeded(false);
    } catch (error) {
      console.error(`Error clearing ${key} from localStorage:`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, clearStorage, isQuotaExceeded];
}
