import { type AppConfig, AppConfigProvider } from "@/lib/app-config";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useStdoutDimensions } from "@/lib/hooks/use-stdout-dimensions";
import { RouterProvider, useRouter } from "@/lib/router";
import { Spinner, ThemeProvider } from "@inkjs/ui";
import { defaultTheme, extendTheme } from "@inkjs/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Box, type BoxProps, render } from "ink";
import type { PropsWithChildren } from "react";
import ChatPage from "./chat/page";
import ListenPage from "./listen/page";
import LoginPage from "./login/page";
import SettingsPage from "./settings/page";
import TasksPage from "./tasks/page";

const customTheme = extendTheme(defaultTheme, {
  components: {},
});

const Router = () => {
  const { data, isLoading } = useAuth();
  const { path } = useRouter();

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

  if (!data && !isLoading) {
    return <LoginPage />;
  }

  // Handle chat with task ID (chat/:id pattern)
  if (typeof path === "object") {
    if (path.route === "/listen") {
      return <ListenPage listen={path.params.listen} />;
    }

    if (path.route === "/chat") {
      return <ChatPage key={path.params.id} taskId={path.params.id} />;
    }
  }

  switch (path) {
    case "/settings":
      return <SettingsPage />;
    case "/tasks":
      return <TasksPage />;
    default:
      throw new Error(`Unknown path: ${path}`);
  }
};

const App = ({ config }: { config: AppConfig }) => {
  const queryClient = new QueryClient({});
  return (
    <QueryClientProvider client={queryClient}>
      <AppConfigProvider config={config}>
        <ThemeProvider theme={customTheme}>
          <RouterProvider>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </RouterProvider>
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
