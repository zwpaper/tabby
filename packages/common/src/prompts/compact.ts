export function createCompactSummaryPrompt(): string {
  return `Create a summary of our conversation, focusing on technical details and user requests.

First, show your thinking process to ensure completeness:
- Review messages chronologically
- Note user requests, code changes, errors, and fixes
- Track files modified and user feedback

Then provide a summary with these sections:

1. Primary Request: What the user asked for
2. Technical Concepts: Key technologies discussed
3. Files & Code: Modified files with relevant snippets
4. Errors & Fixes: Problems encountered and solutions
5. User Messages: Direct user feedback and requests
6. Current Work: What was being done before this summary
7. Next Step: Logical continuation aligned with user requests

Example format:

Thinking:
[Review of conversation flow and key points]

Summary:
1. Primary Request:
   [User's main goal]

2. Technical Concepts:
   - [Technology/framework used]

3. Files & Code:
   - [filename]: [change made + code snippet]

4. Errors & Fixes:
   - [Error encountered]: [How it was resolved]

5. User Messages:
   - [Key feedback or direction changes]

6. Current Work:
   [Last task before summary]

7. Next Step:
   [If applicable, what comes next based on user's request]
`;
}
