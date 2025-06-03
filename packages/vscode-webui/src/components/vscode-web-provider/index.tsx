import styleDefault from "./style.css?inline";

import styleVscodeDark from "./vscode-dark.css?inline";
import styleVscodeDefault from "./vscode-default.css?inline";
import styleVscodeLight from "./vscode-light.css?inline";

export function VSCodeWebProvider({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <style scoped>
        {styleDefault}
        {styleVscodeDefault}
        {styleVscodeDark}
        {styleVscodeLight}
      </style>
      {children}
    </div>
  );
}
