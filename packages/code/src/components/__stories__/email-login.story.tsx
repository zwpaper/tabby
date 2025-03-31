import EmailLogin from "../email-login"; // Adjust the import path as needed

// Mock API functions for Storybook
const mockSendMagicCode = async (email: string): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  // Simulate success or failure for testing
  if (email.includes("fail")) {
    throw new Error("Failed to send code"); // Simulate failure by throwing an error
  }
};

const mockVerifyMagicCode = async (
  _email: string,
  code: string,
): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const success = code === "123456"; // Simulate verification
  if (!success) {
    throw new Error("Invalid code"); // Simulate failure by throwing an error
  }
};

const storyExport = {
  stories: [
    {
      id: "emailLoginDefault",
      title: "Email Login",
      component: (
        <EmailLogin
          sendMagicCode={mockSendMagicCode}
          verifyMagicCode={mockVerifyMagicCode}
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
            throw new Error("Simulated send failure");
          }}
          verifyMagicCode={mockVerifyMagicCode}
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
            throw new Error("Simulated verify failure");
          }}
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
