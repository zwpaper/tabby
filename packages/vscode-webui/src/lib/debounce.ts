import { funnel } from "remeda";

// biome-ignore lint/suspicious/noExplicitAny: match functions
export function debounceWithCachedValue<F extends (...args: any) => any>(
  func: F,
  wait = 0,
  {
    leading = false,
    trailing = true,
    maxWait,
  }: {
    readonly leading?: boolean;
    readonly trailing?: boolean;
    readonly maxWait?: number;
  } = {},
) {
  let cachedValue: ReturnType<F> | undefined;

  const { call, flush, cancel } = funnel(
    (args: Parameters<F>) => {
      if (!leading && !trailing) {
        // In Lodash you can disable both the trailing and leading edges of the
        // debounce window, effectively causing the function to never be
        // invoked. Remeda uses the invokedAt enum exactly to prevent such a
        // situation; so to simulate Lodash we need to only pass the callback
        // when at least one of them is enabled.
        return;
      }

      // Funnel provides more control over the args, but lodash simply passes
      // them through, to replicate this behavior we need to spread the args
      // array maintained via the reducer below.
      // Also, every time the function is invoked the cached value is updated.
      cachedValue = func(...args) as ReturnType<F>;
    },
    {
      // Debounce stores the latest args it was called with for the next
      // invocation of the callback.
      reducer: (_, ...args: Parameters<F>) => args,
      minQuietPeriodMs: wait,
      ...(maxWait !== undefined && { maxBurstDurationMs: maxWait }),
      ...(trailing
        ? leading
          ? { triggerAt: "both" }
          : { triggerAt: "end" }
        : { triggerAt: "start" }),
    },
  );

  // Lodash uses a legacy JS-isms to attach helper functions to the main
  // callback of `debounce`. In Remeda we return a proper object where the
  // callback is one of the available properties. Here we destructure and then
  // reconstruct the object to fit the Lodash API.
  return Object.assign(
    (...args: Parameters<F>) => {
      call(...args);
      return cachedValue;
    },
    {
      flush: () => {
        flush();
        return cachedValue;
      },

      cancel,
    },
  );
}
