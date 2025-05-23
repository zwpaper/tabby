import { useEffect, useRef } from "react";

/**
 * Hook that returns a ref that always contains the latest value.
 * Useful for accessing current values in callbacks without stale closures.
 *
 * @param value - The value to keep in sync with the ref
 * @returns A ref object containing the latest value
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
