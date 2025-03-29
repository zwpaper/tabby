import { TextInput } from "@inkjs/ui";
import { Box, Text, useInput } from "ink";
import type React from "react";
import { useState } from "react";

interface EmailLoginProps {
  sendMagicCode: (email: string) => Promise<boolean>;
  verifyMagicCode: (email: string, code: string) => Promise<boolean>;
  onLoginSuccess?: (email: string) => void; // Optional callback on successful login
}

const EmailLogin: React.FC<EmailLoginProps> = ({
  sendMagicCode,
  verifyMagicCode,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code" | "loggedIn" | "error">(
    "email",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleEmailSubmit = async () => {
    // Basic email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || isLoading) return;
    if (!emailRegex.test(email)) {
      setErrorMessage("Please enter a valid email address.");
      setStep("error"); // Or keep step as 'email' but show error
      return;
    }
    setIsLoading(true);
    setErrorMessage("");
    try {
      const success = await sendMagicCode(email);
      if (success) {
        setStep("code");
      } else {
        setErrorMessage("Failed to send magic code. Please try again.");
        setStep("error");
      }
      // biome-ignore lint/suspicious/noExplicitAny: catching any error
    } catch (error: any) {
      setErrorMessage(error || "An error occurred. Please try again.");
      setStep("error");
    }
    setIsLoading(false);
  };

  const handleCodeSubmit = async () => {
    if (!code || isLoading) return;
    setIsLoading(true);
    setErrorMessage("");
    try {
      const success = await verifyMagicCode(email, code);
      if (success) {
        setStep("loggedIn");
        onLoginSuccess?.(email); // Call the success callback
      } else {
        setErrorMessage("Invalid magic code. Please try again.");
        setStep("error");
      }
      // biome-ignore lint/suspicious/noExplicitAny: catching any error
    } catch (error: any) {
      setErrorMessage(
        error?.message || "An error occurred during verification.",
      );
      setStep("error");
    }
    setIsLoading(false);
  };

  const reset = () => {
    // Don't reset email when retrying from code error
    // setEmail('');
    setCode("");
    setStep(step === "error" && email ? "code" : "email"); // Go back to code entry if email was already submitted
    setErrorMessage("");
    setIsLoading(false);
  };

  useInput((input) => {
    if (input.toLowerCase() === "r" && step === "error") {
      reset();
    }
  });

  return (
    <Box
      flexDirection="column"
      padding={1}
      borderStyle="round"
      borderColor="cyan"
    >
      <Text bold color="cyan">
        Magic Link Login
      </Text>
      {isLoading && <Text color="yellow">Loading...</Text>}
      {errorMessage && (
        <Box flexDirection="column" gap={1}>
          <Text color="red">{errorMessage}</Text>
          <Text>Press 'r' to retry.</Text>
        </Box>
      )}

      {step === "email" && !isLoading && !errorMessage && (
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text>Enter your email: </Text>
            <TextInput
              onChange={setEmail}
              onSubmit={handleEmailSubmit}
              placeholder="you@example.com"
            />
          </Box>
          <Text dimColor>(Press Enter to submit)</Text>
        </Box>
      )}

      {step === "code" && !isLoading && !errorMessage && (
        <Box flexDirection="column" marginTop={1}>
          <Text>Magic code sent to {email}.</Text>
          <Box>
            <Text>Enter code: </Text>
            <TextInput
              onChange={setCode}
              onSubmit={handleCodeSubmit}
              placeholder="123456"
            />
          </Box>
          <Text dimColor>(Press Enter to verify)</Text>
        </Box>
      )}

      {step === "loggedIn" && (
        <Box marginTop={1}>
          <Text color="green">Successfully logged in as {email}!</Text>
        </Box>
      )}
    </Box>
  );
};

export default EmailLogin;
