import { Box, Text } from "ink"; // Import Text if needed to display state
import { useState } from "react";
import Toggle from "../toggle"; // Adjust the import path as needed

// Wrapper component to manage state for the Toggle
const ToggleWrapper = ({
  initialValue = false,
}: { initialValue?: boolean }) => {
  const [isOn, setIsOn] = useState(initialValue);

  return (
    <Box flexDirection="column" gap={1}>
      <Text>Toggle Example (Press Y/N when focused):</Text>
      <Toggle value={isOn} onChange={setIsOn} />
      <Text>Current value: {isOn ? "On (Y)" : "Off (N)"}</Text>
    </Box>
  );
};

const storyExport = {
  stories: [
    {
      id: "toggleDefault",
      title: "Toggle (Default Off)",
      component: <ToggleWrapper initialValue={false} />,
    },
    {
      id: "toggleInitialTrue",
      title: "Toggle (Initially On)",
      component: <ToggleWrapper initialValue={true} />,
    },
  ],
  meta: {
    group: "Components",
    order: 4, // Assuming email-login is 3
  },
};

export default storyExport;
