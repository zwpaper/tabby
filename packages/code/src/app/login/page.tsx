import EmailLogin from "@/components/email-login";
import { useAuth } from "@/lib/auth";
import { Box } from "ink";

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

export default LoginPage;
