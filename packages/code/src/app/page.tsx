import EmailLogin from "@/components/email-login";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Spinner, ThemeProvider } from "@inkjs/ui";
import { Box, type BoxProps, render } from "ink";
import Chat from "./chat/page";

import { type AppConfig, AppConfigProvider } from "@/lib/app-config";
import { useStdoutDimensions } from "@/lib/hooks/use-stdout-dimensions";
import { defaultTheme, extendTheme } from "@inkjs/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

const customTheme = extendTheme(defaultTheme, {
  components: {},
});

const ChatPage = () => {
  return <Chat />;
};

const LoginPage = () => {
  const { sendMagicCode, loginWithMagicCode } = useAuth();

  return (
    <Box justifyContent="center" alignItems="center" flexGrow={1}>
      <EmailLogin
        sendMagicCode={sendMagicCode}
        verifyMagicCode={loginWithMagicCode}
      />
    </Box>
  );
};

const Router = () => {
  const { data, isLoading } = useAuth();
  if (isLoading) {
    return (
      <Box margin={1} flexDirection="column">
        <Spinner />
      </Box>
    );
  }

  return data ? <ChatPage /> : <LoginPage />;
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
