WITH transformParams AS (
  SELECT *, 
    (
      SELECT
        bool_and(
          -- Condition for each user message
          (
            -- Either all content parts are API responses
            (SELECT COALESCE(bool_and(part->>'text' LIKE '<api-response%'), true) FROM jsonb_array_elements(message->'content') as part)
            OR
            -- Or the first content part starts with '<environment-details>' (Legacy)
            (message->'content'->0->>'text' LIKE '<environment-details>%')
            OR
            -- Or the first content part starts with '<system-reminder>'
            (message->'content'->0->>'text' LIKE '<system-reminder>%')
          )
        )
      FROM
        jsonb_array_elements(spans.output->'prompt') as message
      WHERE
        message->>'role' = 'user'
    ) as is_valid
  FROM spans WHERE span_type = 'DEFAULT' AND name = 'transformParams'
), streamText AS (
  SELECT * FROM spans WHERE span_type = 'DEFAULT' AND name = 'ai.streamText'
  AND (attributes->>'ai.response.finishReason')::text = 'tool-calls'
      AND (attributes->>'ai.response.toolCalls')::text LIKE '%attemptCompletion%'
      AND (attributes->>'ai.model.id')::text = 'gemini-2.5-pro'
      AND (attributes->>'ai.usage.promptTokens')::integer > 40000
      AND (attributes->>'ai.usage.promptTokens')::integer < 110000
)
SELECT 
  (streamText.attributes->>'ai.telemetry.metadata.task-id')::text as uid,
  (streamText.attributes->>'ai.telemetry.metadata.user-email')::text as email,
  (streamText.attributes->>'ai.response.text')::text as text,
  (streamText.attributes->>'ai.response.toolCalls')::jsonb as tool_calls,
  transformParams.output->'prompt' AS messages
FROM streamText JOIN transformParams USING (trace_id)
WHERE transformParams.is_valid is not false AND transformParams.output->'prompt' is not NULL AND ((transformParams.output->'prompt')::text NOT LIKE '%<ctrl42>%')
LIMIT 1000