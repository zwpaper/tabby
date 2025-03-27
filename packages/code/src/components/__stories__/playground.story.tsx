import { Text } from "ink";
import Collapsible from "../collapsible";

const storyExport = {
  stories: [
    {
      id: "collapsible",
      title: "Collapsible",
      component: (
        <Collapsible title="Collapsible">
          <Text>internal content</Text>
        </Collapsible>
      ),
    },
  ],
  meta: {
    group: "Inputs",
    order: 1,
  },
};

export default storyExport;
