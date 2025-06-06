Plan

1. define following type to track streaming tool call.

```
type StreamingToolCall = {
  buffer: string;
  toolCallId: string;
} & (
  | {
      type: "streaming-name";
    }
  | {
      toolName: string;
      type: "streaming-args";
    }
);
```

2. change the tool call format to below

```
<tool-call name="<function-name>">
{arguments in json}
</tool-call>
```

3. Properly invoke the controller to stream arguments and update buffer correspondingly.

```
controller.enqueue({
        type: "tool-call-delta",
        toolCallId: toolCallId,
        toolName: toolName,
        argDelta: delta
})
```
