import { useEffect, useState } from "react";
import type React from "react";
import type { Message } from "../types";

interface ApiRequestEntry {
  name: string;
  messageIndex: number;
  partIndex: number;
  requestIndexInPart: number;
  globalIndex: number;
}

interface ResponseTocProps {
  messages: Message[];
}

const extractApiRequests = (messages: Message[]): ApiRequestEntry[] => {
  const requests: ApiRequestEntry[] = [];
  let globalIndex = 1;
  messages.forEach((message, messageIndex) => {
    if (
      (message.role === "assistant" || message.role === "user") &&
      Array.isArray(message.content)
    ) {
      message.content.forEach((part, partIndex) => {
        const text = part.newText ?? part.text;
        if (typeof text === "string") {
          // Use the same regex pattern as message-content.tsx
          const parts = text.split(
            /(<api-request .*?<\/api-request>|<(?:system-reminder|user-reminder)>[\s\S]*?<\/(?:system-reminder|user-reminder)>|<environment-details>[\s\S]*?<\/environment-details>)/gs,
          );
          let requestCounter = 0;
          // biome-ignore lint/complexity/noForEach: <explanation>
          parts.forEach((splitPart) => {
            const isApiRequest = /(<api-request .*?<\/api-request>)/gs.test(
              splitPart,
            );
            const isSystemReminder =
              /(<(?:system-reminder|user-reminder)>[\s\S]*?<\/(?:system-reminder|user-reminder)>)/gs.test(
                splitPart,
              );
            const isEnvironmentDetails =
              /(<environment-details>[\s\S]*?<\/environment-details>)/gs.test(
                splitPart,
              );

            if (isApiRequest || isSystemReminder || isEnvironmentDetails) {
              let name: string;
              if (isApiRequest) {
                // Extract the name from api-request
                const nameMatch = splitPart.match(
                  /<api-request name="([^"]+)">/,
                );
                name = nameMatch ? nameMatch[1] : "api-request";
              } else if (isSystemReminder) {
                // Both system-reminder and user-reminder are treated as "system-reminder"
                name = "system-reminder";
              } else {
                name = "environment-details";
              }

              requests.push({
                name: name,
                messageIndex,
                partIndex,
                requestIndexInPart: requestCounter++,
                globalIndex: globalIndex++,
              });
            }
          });
        }
      });
    }
  });
  return requests;
};

export const ResponseToc: React.FC<ResponseTocProps> = ({ messages }) => {
  const [apiRequests, setApiRequests] = useState<ApiRequestEntry[]>([]);
  const [uniqueToolNames, setUniqueToolNames] = useState<string[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  useEffect(() => {
    const requests = extractApiRequests(messages);
    const names = [...new Set(requests.map((req) => req.name))];
    setUniqueToolNames(names);

    let filteredRequests = requests;
    if (selectedFilters.length > 0) {
      filteredRequests = filteredRequests.filter((req) =>
        selectedFilters.includes(req.name),
      );
    }

    setApiRequests(filteredRequests);
  }, [messages, selectedFilters]);

  if (apiRequests.length === 0 && uniqueToolNames.length === 0) {
    return null;
  }

  const handleLinkClick = (request: ApiRequestEntry) => {
    let elementId: string;
    if (request.name === "system-reminder") {
      elementId = `system-reminder-${request.messageIndex}-${request.partIndex}-${request.requestIndexInPart}`;
    } else if (request.name === "environment-details") {
      elementId = `environment-details-${request.messageIndex}-${request.partIndex}-${request.requestIndexInPart}`;
    } else {
      elementId = `api-request-${request.messageIndex}-${request.partIndex}-${request.requestIndexInPart}`;
    }
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="response-toc flex h-full flex-col">
      <div className="sticky top-0 z-10 bg-muted/30 p-4">
        <h4 className="mb-2 font-semibold">API Requests & System Elements</h4>
        <div className="mb-2 flex flex-wrap gap-2">
          {uniqueToolNames.map((name) => (
            <div key={name} className="flex items-center">
              <input
                id={`filter-${name}`}
                type="checkbox"
                checked={selectedFilters.includes(name)}
                onChange={() => {
                  setSelectedFilters((prev) =>
                    prev.includes(name)
                      ? prev.filter((f) => f !== name)
                      : [...prev, name],
                  );
                }}
                className="h-4 w-4 rounded border-input text-primary"
              />
              <label
                htmlFor={`filter-${name}`}
                className="ml-2 block text-foreground text-sm"
              >
                {name}
              </label>
            </div>
          ))}
        </div>
      </div>
      <ul className="overflow-y-auto p-4">
        {apiRequests.map((request, index) => (
          <li key={index} className="mb-1">
            <button
              type="button"
              onClick={() => handleLinkClick(request)}
              className="w-full rounded bg-transparent p-1 text-left text-gray-600 text-sm hover:bg-gray-100 hover:text-gray-900"
            >
              <span className="mr-2 font-mono text-gray-400 text-xs">
                #{request.globalIndex}
              </span>
              {request.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
