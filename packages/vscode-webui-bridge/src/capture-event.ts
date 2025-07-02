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
        numToolCalls?: number;
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
        batched: boolean;
        status: "success" | "error" | "aborted";
      };
    }
  | {
      event: "importThirdPartyRules";
      properties: {
        rulePaths: string[];
      };
    }
  | {
      event: "sharePublic";
      properties?: undefined;
    };
