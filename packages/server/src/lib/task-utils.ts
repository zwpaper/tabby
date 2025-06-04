import Sqids from "sqids";

const { uidEncode, uidDecode } = (() => {
  const alphabet =
    "RBgHuE5stw6UbcCoZJiamLkyYnqV1xSO8efMhzXK3vI9F27WPrd0jA4lGTNpQD";
  const coder = new Sqids({ minLength: 8, alphabet });
  return {
    uidEncode: (id: number) => coder.encode([id]),
    uidDecode: (id: string) => coder.decode(id)[0],
  };
})();

export { uidEncode, uidDecode };
