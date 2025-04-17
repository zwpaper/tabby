import { type AppConfig, AppConfigProvider } from "@/lib/app-config";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useStdoutDimensions } from "@/lib/hooks/use-stdout-dimensions";
import { RouterProvider, useRouter } from "@/lib/router";
import { UserEventProvider } from "@/lib/user-event"; // Import UserEventProvider
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

  // Handle routes with parameters
  if (typeof path === "object") {
    if (path.route === "/listen") {
      // ListenPage no longer needs the 'listen' prop
      return <ListenPage />;
    }

    if (path.route === "/chat") {
      return <ChatPage key={path.params.id} taskId={path.params.id} />;
    }
  }

  // Handle simple string paths
  switch (path) {
    case "/settings":
      return <SettingsPage />;
    case "/tasks":
      return <TasksPage />;
    default:
      // It's possible the path is an object but didn't match above, or an unknown string
      // Consider adding a default route or better error handling
      throw new Error(`Unknown or unhandled path: ${JSON.stringify(path)}`);
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
              {/* Wrap Router with UserEventProvider */}
              <UserEventProvider>
                <Router />
              </UserEventProvider>
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
