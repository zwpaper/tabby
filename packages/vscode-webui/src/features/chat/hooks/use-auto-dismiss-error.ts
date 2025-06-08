import { useEffect, useState } from "react";

export const useAutoDismissError = (timeout = 5000) => {
  const [error, setError] = useState<Error | undefined>(undefined);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(undefined);
      }, timeout);
      return () => clearTimeout(timer);
    }
  }, [error, timeout]);

  return { error, setError };
};
