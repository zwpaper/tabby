import * as os from "node:os";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@inkjs/ui";
import { Box, Text } from "ink";
import { useCallback, useEffect, useState } from "react";

const LoginPage = () => {
  const [error, setError] = useState<string | null>(null);
  const { authClient } = useAuth();
  const deviceName = `${os.type()} ${os.release()}`;
  const [data, setData] =
    useState<ReturnType<typeof authClient.signIn.deviceLink>>(null);

  const onError = useCallback((error: Error) => {
    setError(error.message);
    setData(null);
  }, []);

  useEffect(() => {
    if (data === null) {
      authClient.signIn
        .deviceLink({
          deviceName,
        })
        .then(({ data }) => setData(data));
    }
  }, [authClient.signIn.deviceLink, data, deviceName]);

  return (
    <Box
      justifyContent="center"
      alignItems="center"
      flexGrow={1}
      flexDirection="column"
      gap={1}
    >
      <Text color="yellow">Welcome to Ragdoll Code!</Text>
      {!data && <Spinner />}
      {data && (
        <>
          {error && (
            <Text color="red">Failed to login, {error}, please try again.</Text>
          )}
          <Text>Please open the following link in your browser to sign in</Text>
          <Text>{data.approveLink}</Text>
          <VerifyDeviceLink token={data.token} onError={onError} />
        </>
      )}
    </Box>
  );
};

function VerifyDeviceLink({
  token,
  onError,
}: { token: string; onError?: (error: Error) => void }) {
  const { authClient, renewToken } = useAuth();
  useEffect(() => {
    authClient.deviceLink
      .verify({
        query: {
          token,
        },
      })
      .then(({ data, error }) => {
        if (error) {
          onError?.(new Error(error.message));
          return;
        }

        if ("error" in data) {
          onError?.(new Error(data.error));
          return;
        }

        renewToken(data.token);
      });
  }, [authClient.deviceLink.verify, token, renewToken, onError]);

  return <></>;
}

export default LoginPage;
