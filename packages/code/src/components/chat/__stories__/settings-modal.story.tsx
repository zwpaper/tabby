import { Box, Text } from "ink";
import React, { useState } from "react";
import SettingsModal from "../settings-modal"; // Adjusted import path

// Wrapper component to manage state and provide context for the SettingsModal
const SettingsModalWrapper: React.FC<{}> = () => {
  // In a real story, you might want a button or trigger to open the modal.
  // For simplicity, we'll just render it directly.
  // The onClose prop can be logged or used to update state if needed.
  const [isClosed, setIsClosed] = useState(false);

  const handleClose = () => {
    setIsClosed(true);
    // You could add a delay or mechanism to re-open for testing if needed
    // setTimeout(() => setIsClosed(false), 2000);
  };

  if (isClosed) {
    return <Text>Modal closed. (Re-run story to reopen)</Text>;
  }

  return (
    <Box flexDirection="column" width={64}>
      <Text>Settings Modal Story:</Text>
      <SettingsModal onClose={handleClose} />
      {/* You can add other elements around the modal if needed */}
    </Box>
  );
};

const storyExport = {
  stories: [
    {
      id: "settingsModalDefault",
      title: "Settings Modal (Default)",
      component: <SettingsModalWrapper />,
    },
  ],
  meta: {
    group: "Components/Chat", // Group under Chat components
    // Adjust order as needed relative to other components
    order: 2, // Example order, assuming UserTextInput is 1
  },
};

export default storyExport;
