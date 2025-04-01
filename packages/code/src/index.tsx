import { AuthProvider, useAuth } from "@/lib/auth";
import { Spinner, ThemeProvider } from "@inkjs/ui";
import { Box, render } from "ink";
import Chat from "./components/chat";
import EmailLogin from "./components/email-login";

import { defaultTheme, extendTheme } from "@inkjs/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type AppConfig, AppConfigProvider } from "./lib/app-config";

const customTheme = extendTheme(defaultTheme, {
  components: {},
});

const ChatPage = () => {
  return (
    <Box margin={1} flexDirection="column">
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
  render(<App config={config} />);
}
