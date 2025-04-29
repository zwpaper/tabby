"use client";

import type React from "react";
import { useEffect, useState } from "react";

import { useDebounce } from "react-use";
import { Skeleton } from "./ui/skeleton";

interface LoadingWrapperProps {
  loading?: boolean;
  children?: React.ReactNode;
  fallback?: React.ReactNode;
  delay?: number;
  triggerOnce?: boolean;
}

export const LoadingWrapper: React.FC<LoadingWrapperProps> = ({
  triggerOnce = true,
  loading,
  fallback,
  delay,
  children,
}) => {
  const [loaded, setLoaded] = useState(!loading);
  const [debouncedLoaded, setDebouncedLoaded] = useState(loaded);

  // biome-ignore lint/correctness/useExhaustiveDependencies: no need to watch loaded
  useEffect(() => {
    if (!triggerOnce) {
      setLoaded(!loading);
    } else if (!loading && !loaded) {
      setLoaded(true);
    }
  }, [loading, triggerOnce]);

  useDebounce(
    () => {
      setDebouncedLoaded(loaded);
    },
    delay ?? 200,
    [loaded],
  );

  if (!debouncedLoaded) {
    return fallback ? fallback : <Skeleton />;
  }

  return children;
};

export default LoadingWrapper;
