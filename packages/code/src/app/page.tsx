import { type AppConfig, AppConfigProvider } from "@/lib/app-config";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useStdoutDimensions } from "@/lib/hooks/use-stdout-dimensions";
import { Spinner, ThemeProvider } from "@inkjs/ui";
import { defaultTheme, extendTheme } from "@inkjs/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Box, type BoxProps, render } from "ink";
import type { PropsWithChildren } from "react";
import ChatPage from "./chat/page";
import LoginPage from "./login/page";

const customTheme = extendTheme(defaultTheme, {
  components: {},
});

const Router = () => {
  const { data, isLoading } = useAuth();
  if (data) return <ChatPage />;

  if (isLoading) {
    return (
      <Box
        flexDirection="column"
        width="100%"
        height="100%"
        justifyContent="center"
        alignItems="center"
      >
        <Spinner label="Loading" />
      </Box>
    );
  }

  return <LoginPage />;
};

const App = ({ config }: { config: AppConfig }) => {
  const queryClient = new QueryClient({});
  return (
    <QueryClientProvider client={queryClient}>
      <AppConfigProvider config={config}>
        <ThemeProvider theme={customTheme}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </ThemeProvider>
      </AppConfigProvider>
    </QueryClientProvider>
  );
};

export function app(config: AppConfig) {
  if (config.fullscreen) {
    renderFullScreen(<App config={config} />);
  } else {
    render(<App config={config} />);
  }
}

const FullScreen: React.FC<PropsWithChildren<BoxProps>> = ({
  children,
  ...styles
}) => {
  const [columns, rows] = useStdoutDimensions();
  return (
    <Box width={columns} height={rows} {...styles}>
      {children}
    </Box>
  );
};

export const renderFullScreen = (element: React.ReactNode) => {
  process.stdout.write("\x1b[?1049h");
  const instance = render(<FullScreen>{element}</FullScreen>);
  instance.waitUntilExit().then(() => process.stdout.write("\x1b[?1049l"));
  return instance;
};
