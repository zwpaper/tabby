import { Edit3 } from "lucide-react";
import { useEffect, useState } from "react";
import type React from "react";
import { useTaskView } from "../contexts/task-view-context";
import { type ConversationRound, useRounds } from "../hooks/use-rounds";
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

export const ResponseToc: React.FC<ResponseTocProps> = ({ messages }) => {
  const { rounds, apiRequests } = useRounds(messages);
  const [uniqueToolNames, setUniqueToolNames] = useState<string[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [filteredApiRequests, setFilteredApiRequests] = useState<
    ApiRequestEntry[]
  >([]);

  const { showOnlyEditedMessages, setShowOnlyEditedMessages } = useTaskView();

  useEffect(() => {
    const names = [...new Set(apiRequests.map((req) => req.name))];
    setUniqueToolNames(names);

    let filtered = apiRequests;
    if (selectedFilters.length > 0) {
      filtered = filtered.filter((req) => selectedFilters.includes(req.name));
    }

    if (showOnlyEditedMessages) {
      filtered = filtered.filter((req) => {
        const message = messages[req.messageIndex];
        return hasEditedOrDeletedContent(message);
      });
    }

    setFilteredApiRequests(filtered);
  }, [apiRequests, selectedFilters, showOnlyEditedMessages, messages]);

  // Helper function to check if a message has been edited or deleted
  const hasEditedOrDeletedContent = (message: Message) => {
    if (message.isDeleted) return true;

    if (Array.isArray(message.content)) {
      return message.content.some(
        (part) => part.isDeleted || part.newText !== undefined,
      );
    }
    return false;
  };

  if (
    apiRequests.length === 0 &&
    uniqueToolNames.length === 0 &&
    rounds.length === 0
  ) {
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

  const handleRoundClick = (round: ConversationRound) => {
    const messageElement = document.getElementById(
      `message-${round.startMessageIndex}`,
    );
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const filteredRounds = rounds
    .map((round) => {
      let filteredApiRequests = round.apiRequests;

      if (selectedFilters.length > 0) {
        filteredApiRequests = filteredApiRequests.filter((req) =>
          selectedFilters.includes(req.name),
        );
      }

      if (showOnlyEditedMessages) {
        filteredApiRequests = filteredApiRequests.filter((req) =>
          hasEditedOrDeletedContent(messages[req.messageIndex]),
        );
      }

      return {
        ...round,
        apiRequests: filteredApiRequests,
      };
    })
    .filter((round) => {
      if (!showOnlyEditedMessages) {
        return true;
      }

      const hasVisibleApiRequests = round.apiRequests.length > 0;
      const userMessageHasEdits =
        round.userMessageIndex !== undefined &&
        hasEditedOrDeletedContent(messages[round.userMessageIndex]);
      const assistantMessageHasEdits =
        round.assistantMessageIndex !== undefined &&
        hasEditedOrDeletedContent(messages[round.assistantMessageIndex]);

      return (
        hasVisibleApiRequests || userMessageHasEdits || assistantMessageHasEdits
      );
    });

  return (
    <div className="response-toc flex h-full flex-col">
      <div className="sticky top-0 z-10 bg-muted/30 p-4">
        <h4 className="mb-2 font-semibold">Interaction Details</h4>

        {uniqueToolNames.length > 0 && (
          <>
            <h5 className="block font-semibold">Filter by Tool</h5>
            <div className="my-1 flex items-center">
              <input
                id="show-only-edited-checkbox"
                type="checkbox"
                checked={showOnlyEditedMessages}
                onChange={(e) => setShowOnlyEditedMessages(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary"
              />
              <label
                htmlFor="show-only-edited-checkbox"
                className="ml-2 flex items-center gap-1 text-foreground text-sm"
              >
                <Edit3 className="h-4 w-4" />
                Show only edited messages
              </label>
            </div>
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
          </>
        )}
      </div>

      <div className="overflow-y-auto p-4">
        {filteredRounds.length > 0 ? (
          <div className="space-y-1">
            {filteredRounds.map((round) => {
              const userNum =
                round.userMessageIndex !== undefined
                  ? round.userMessageIndex + 1
                  : "?";
              const assistantNum =
                round.assistantMessageIndex !== undefined
                  ? round.assistantMessageIndex + 1
                  : "?";

              const userMessageHasEdits =
                round.userMessageIndex !== undefined &&
                hasEditedOrDeletedContent(messages[round.userMessageIndex]);
              const assistantMessageHasEdits =
                round.assistantMessageIndex !== undefined &&
                hasEditedOrDeletedContent(
                  messages[round.assistantMessageIndex],
                );
              const roundHasEdits =
                userMessageHasEdits || assistantMessageHasEdits;

              return (
                <div key={round.roundIndex}>
                  <button
                    type="button"
                    onClick={() => handleRoundClick(round)}
                    className={`w-full rounded px-2 py-1 text-left font-medium text-sm hover:bg-accent/50 ${
                      roundHasEdits
                        ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200"
                        : "text-foreground"
                    }`}
                  >
                    Round #{round.roundIndex} (user #{userNum}/assistant #
                    {assistantNum})
                  </button>
                  {round.apiRequests.map(
                    (request: ApiRequestEntry, index: number) => (
                      <div key={index} className="ml-4">
                        <button
                          type="button"
                          onClick={() => handleLinkClick(request)}
                          className="w-full rounded px-2 py-1 text-left text-muted-foreground text-sm hover:bg-accent/30 hover:text-foreground"
                        >
                          {request.name}
                        </button>
                      </div>
                    ),
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          filteredApiRequests.length > 0 && (
            <ul className="space-y-1">
              {filteredApiRequests.map((request, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => handleLinkClick(request)}
                    className="w-full rounded bg-transparent p-2 text-left text-gray-600 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    {request.name}
                  </button>
                </li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  );
};
