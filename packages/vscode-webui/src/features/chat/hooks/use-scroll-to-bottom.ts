import { useIsAtBottom } from "@/lib/hooks/use-is-at-bottom";
import type React from "react";
import { useEffect, useLayoutEffect } from "react";

interface UseScrollToBottomProps {
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  isLoading: boolean;
  hasPendingApproval: boolean;
}

export function useScrollToBottom({
  messagesContainerRef,
  isLoading,
  hasPendingApproval,
}: UseScrollToBottomProps) {
  const { isAtBottom, scrollToBottom } = useIsAtBottom(messagesContainerRef);

  // Scroll to bottom when the message list height changes
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container?.children[0]) {
      return;
    }
    const resizeObserver = new ResizeObserver(() => {
      if (isAtBottom) {
        requestAnimationFrame(() => scrollToBottom());
      }
    });
    resizeObserver.observe(container.children[0]);
    return () => {
      resizeObserver.disconnect();
    }; // clean up
  }, [isAtBottom, scrollToBottom, messagesContainerRef]);

  // scroll to bottom immediately when a user message is sent
  useLayoutEffect(() => {
    if (isLoading) {
      scrollToBottom();
    }
  }, [isLoading, scrollToBottom]);

  // Initial scroll to bottom once when component mounts (without smooth behavior)
  useLayoutEffect(() => {
    if (messagesContainerRef.current) {
      scrollToBottom(false); // false = not smooth
    }
  }, [scrollToBottom, messagesContainerRef]);

  // Ensure users can always see the executing approval or the pause approval that require their input
  useLayoutEffect(() => {
    if (!isLoading && hasPendingApproval) {
      scrollToBottom(false);
    }
  }, [hasPendingApproval, isLoading, scrollToBottom]);
}
