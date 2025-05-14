import { withThemeByClassName } from "@storybook/addon-themes";
import { MINIMAL_VIEWPORTS } from "@storybook/addon-viewport";
import type { Preview } from "@storybook/react";
import "./vscode-modern-dark.css";
import "./vscode-default.css";
import "../src/styles.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      options: {
        light: { name: "Light", value: "#ffffff" },
        dark: { name: "Dark", value: "#000000" },
      },
    },
    viewport: {
      options: MINIMAL_VIEWPORTS,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  initialGlobals: {
    backgrounds: {
      value: "dark",
    },
    viewport: { value: "mobile1" },
  },
};

export const decorators = [
  withThemeByClassName({
    themes: {
      light: "vscode-light",
      dark: "vscode-dark",
    },
    defaultTheme: "dark",
  }),
];

export default preview;
