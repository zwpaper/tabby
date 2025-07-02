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
  const alphabet = "vec4mzptidk51qw26h9gj7xfro80yunba3ls";
  const coder = new Sqids({ minLength: 8, alphabet });
  return {
    encode: (id: number) => coder.encode([id]),
    decode: (id: string) => coder.decode(id)[0],
  };
})();
