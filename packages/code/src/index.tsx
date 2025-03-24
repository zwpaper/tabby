import { Alert, ThemeProvider } from "@inkjs/ui";
import { Box, render } from "ink";
import Chat from "./components/chat";

import { defaultTheme, extendTheme } from "@inkjs/ui";

const customTheme = extendTheme(defaultTheme, {
  components: {},
});

const App = () => {
  return (
    <ThemeProvider theme={customTheme}>
      <Box margin={1} flexDirection="column">
        <Box width={32}>
          <Alert variant="info">Ragdoll Code is in beta.</Alert>
        </Box>

        <Chat />
      </Box>
    </ThemeProvider>
  );
};

render(<App />);
