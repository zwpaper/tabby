export type AbortableFunctionType<T> = T extends (
  ...args: infer Args
) => infer Return
  ? (...args: [...Args, AbortSignal]) => Return
  : never;
