import { AuthProvider, useAuth } from "@/lib/auth";
import { Spinner, ThemeProvider } from "@inkjs/ui";
import { Box, type BoxProps, type RenderOptions, render } from "ink";
import Chat from "./components/chat";
import EmailLogin from "./components/email-login";

import { defaultTheme, extendTheme } from "@inkjs/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren, useEffect, useState } from "react";
import { type AppConfig, AppConfigProvider } from "./lib/app-config";

const customTheme = extendTheme(defaultTheme, {
  components: {},
});

const ChatPage = () => {
  return (
    <Box margin={1} flexDirection="column" width="100%">
      <Chat />
    </Box>
  );
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

function useStdoutDimensions(): [number, number] {
  const { columns, rows } = process.stdout;
  const [size, setSize] = useState({ columns, rows });
  useEffect(() => {
    function onResize() {
      const { columns, rows } = process.stdout;
      setSize({ columns, rows });
    }
    process.stdout.on("resize", onResize);
    return () => {
      process.stdout.off("resize", onResize);
    };
  }, []);
  return [size.columns, size.rows];
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

export const renderFullScreen = (
  element: React.ReactNode,
  options?: RenderOptions,
) => {
  process.stdout.write("\x1b[?1049h");
  const instance = render(<FullScreen>{element}</FullScreen>);
  instance.waitUntilExit().then(() => process.stdout.write("\x1b[?1049l"));
  return instance;
};
