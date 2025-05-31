export type CaptureEvent =
  | {
      event: "newTask";
      properties?: undefined;
    }
  | {
      event: "chatFinish";
      properties: {
        modelId: string | undefined;
        finishReason: string;
      };
    }
  | {
      event: "selectWorkflow";
      properties: {
        workflowId: string;
      };
    }
  | {
      event: "executeToolCall";
      properties: {
        toolName: string;
        durationMs: number;
        status: "success" | "error" | "aborted";
      };
    }
  | {
      event: "importThirdPartyRules";
      properties: {
        rulePaths: string[];
      };
    };
