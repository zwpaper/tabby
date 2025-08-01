import { useStore } from "@livestore/react";
import type React from "react";

import { events } from "../livestore/schema.js";

export const InputForm: React.FC = () => {
  const { store } = useStore();

  const updateEnvironment = () => {
    store.commit(
      events.environmentSet({
        environment: { sample: `Hello from ${new Date().toISOString()}` },
      }),
    );
  };

  return (
    <header className="header">
      <h1>Livestore Demo</h1>
      <button type="button" onClick={updateEnvironment}>
        Update Environment
      </button>
    </header>
  );
};
