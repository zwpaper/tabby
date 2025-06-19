import Sqids from "sqids";

export const uidCoder = (() => {
  const alphabet =
    "RBgHuE5stw6UbcCoZJiamLkyYnqV1xSO8efMhzXK3vI9F27WPrd0jA4lGTNpQD";
  const coder = new Sqids({ minLength: 8, alphabet });
  return {
    encode: (id: number) => coder.encode([id]),
    decode: (id: string) => coder.decode(id)[0],
  };
})();

export const minionIdCoder = (() => {
  const alphabet =
    "iMypeAm79qGcLfO8jtXTk1d5xPE2bUW0H6awuYoCgzVlhQnBsF3ZRJDvKN4IrS";
  const coder = new Sqids({ minLength: 8, alphabet });
  return {
    encode: (id: number) => coder.encode([id]),
    decode: (id: string) => coder.decode(id)[0],
  };
})();
