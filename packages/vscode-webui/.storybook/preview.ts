import { withThemeByClassName } from "@storybook/addon-themes";
import { MINIMAL_VIEWPORTS } from "@storybook/addon-viewport";
import type { Preview } from "@storybook/react";
import "./background.css";
import "./vscode-modern-dark.css";
import "./vscode-modern-light.css";
import "./vscode-default.css";
import "../src/styles.css";

const vscodeViewports = {
  vscodeSmall: {
    name: "VSCode Small",
    styles: {
      width: "150px",
      height: "800px",
    },
  },
  vscodeMedium: {
    name: "VSCode Medium",
    styles: {
      width: "320px",
      height: "800px",
    },
  },
  vscodeLarge: {
    name: "VSCode Large",
    styles: {
      width: "500px",
      height: "800px",
    },
  },
};

const preview: Preview = {
  parameters: {
    viewport: {
      options: { ...vscodeViewports, ...MINIMAL_VIEWPORTS },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  initialGlobals: {
    viewport: { value: "vscodeMedium" },
  },
};

export const decorators = [
  withThemeByClassName({
    themes: {
      light: "light vscode-light vscode-modern-light",
      dark: "dark vscode-dark vscode-modern-dark",
    },
    defaultTheme: "dark",
  }),
];

export default preview;
