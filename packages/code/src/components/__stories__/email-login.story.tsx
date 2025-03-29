import EmailLogin from "../email-login"; // Adjust the import path as needed

// Mock API functions for Storybook
const mockSendMagicCode = async (email: string): Promise<boolean> => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  // Simulate success or failure for testing
  return !email.includes("fail");
};

const mockVerifyMagicCode = async (
  _email: string,
  code: string,
): Promise<boolean> => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const success = code === "123456"; // Simulate verification
  return success;
};

const handleLoginSuccess = (_email: string) => {};

const storyExport = {
  stories: [
    {
      id: "emailLoginDefault",
      title: "Email Login",
      component: (
        <EmailLogin
          sendMagicCode={mockSendMagicCode}
          verifyMagicCode={mockVerifyMagicCode}
          onLoginSuccess={handleLoginSuccess}
        />
      ),
    },
    {
      id: "emailLoginSendFail",
      title: "Email Login (Send Fail)",
      component: (
        <EmailLogin
          sendMagicCode={async () => {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return false;
          }}
          verifyMagicCode={mockVerifyMagicCode}
          onLoginSuccess={handleLoginSuccess}
        />
      ),
    },
    {
      id: "emailLoginVerifyFail",
      title: "Email Login (Verify Fail)",
      component: (
        <EmailLogin
          sendMagicCode={mockSendMagicCode}
          verifyMagicCode={async () => {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return false;
          }}
          onLoginSuccess={handleLoginSuccess}
        />
      ),
    },
  ],
  meta: {
    group: "Components",
    order: 3,
  },
};

export default storyExport;
