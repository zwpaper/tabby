import { useEffect, useState } from "react";
import type React from "react";
import type { Message } from "../types";

interface ApiRequestEntry {
  name: string;
  messageIndex: number;
  partIndex: number;
  requestIndexInPart: number;
}

interface ResponseTocProps {
  messages: Message[];
}

const extractApiRequests = (messages: Message[]): ApiRequestEntry[] => {
  const requests: ApiRequestEntry[] = [];
  messages.forEach((message, messageIndex) => {
    if (message.role === "assistant" && Array.isArray(message.content)) {
      message.content.forEach((part, partIndex) => {
        const text = part.newText ?? part.text;
        if (typeof text === "string") {
          const apiRequestRegex = /<api-request name="([^"]+)">/g;
          let match: RegExpExecArray | null;
          let requestIndexInPart = 0;
          // biome-ignore lint/suspicious/noAssignInExpressions: This is a standard and safe way to iterate through regex matches
          while ((match = apiRequestRegex.exec(text)) !== null) {
            requests.push({
              name: match[1],
              messageIndex,
              partIndex,
              requestIndexInPart: requestIndexInPart++,
            });
          }
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
    const elementId = `api-request-${request.messageIndex}-${request.partIndex}-${request.requestIndexInPart}`;
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="response-toc flex h-full flex-col">
      <div className="sticky top-0 z-10 bg-muted/30 p-4">
        <h4 className="mb-2 font-semibold">API Requests</h4>
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
              {request.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
