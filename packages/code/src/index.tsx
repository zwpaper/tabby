import { AuthProvider, useAuth } from "@/lib/auth";
import { Spinner, ThemeProvider } from "@inkjs/ui";
import { Box, render } from "ink";
import Chat from "./components/chat";
import EmailLogin from "./components/email-login";

import { defaultTheme, extendTheme } from "@inkjs/ui";

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

const App = () => {
  return (
    <ThemeProvider theme={customTheme}>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </ThemeProvider>
  );
};

render(<App />);
