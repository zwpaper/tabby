import { AuthProvider, useAuth } from "@/lib/auth";
import { Spinner, ThemeProvider } from "@inkjs/ui";
import { Box, type BoxProps, render } from "ink";
import Chat from "./components/chat";
import EmailLogin from "./components/email-login";

import { defaultTheme, extendTheme } from "@inkjs/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { type AppConfig, AppConfigProvider } from "./lib/app-config";
import { useStdoutDimensions } from "./lib/hooks/use-stdout-dimensions";

const customTheme = extendTheme(defaultTheme, {
  components: {},
});

const ChatPage = () => {
  return <Chat />;
};

const LoginPage = () => {
  const { sendMagicCode, loginWithMagicCode } = useAuth();

  return (
    <EmailLogin
      sendMagicCode={sendMagicCode}
      verifyMagicCode={loginWithMagicCode}
    />
  );
};

const Router = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <Box margin={1} flexDirection="column">
        <Spinner />
      </Box>
    );
  }

  return user ? <ChatPage /> : <LoginPage />;
};

const App = ({ config }: { config: AppConfig }) => {
  const queryClient = new QueryClient();
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
  renderFullScreen(<App config={config} />);
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
