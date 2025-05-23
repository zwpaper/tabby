import { useEffect, useRef } from "react";

function usePrevious<T>(value: T, initialValue: T): T {
  const ref = useRef(initialValue);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

const useEffectDebugger: typeof useEffect = (
  effectHook,
  dependencies,
  dependencyNames = [],
) => {
  const previousDeps = usePrevious(dependencies, []) || [];

  const changedDeps = (dependencies || []).reduce(
    (accum, dependency, index) => {
      if (dependency !== previousDeps[index]) {
        const keyName = dependencyNames[index] || index;
        return {
          // @ts-expect-error
          // biome-ignore lint/performance/noAccumulatingSpread: <explanation>
          ...accum,
          [keyName]: {
            before: previousDeps[index],
            after: dependency,
          },
        };
      }

      return accum;
    },
    {},
  );

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  if (Object.keys(changedDeps as any).length) {
    console.log("[use-effect-debugger] ", changedDeps);
  }

  useEffect(effectHook, dependencies);
};

export default useEffectDebugger;
