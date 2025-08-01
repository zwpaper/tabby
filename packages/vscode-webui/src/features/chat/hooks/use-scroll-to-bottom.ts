import { useIsAtBottom } from "@/lib/hooks/use-is-at-bottom";
import type React from "react";
import { useEffect, useLayoutEffect, useRef } from "react";

interface UseScrollToBottomProps {
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  isLoading: boolean;
  pendingApprovalName?: string;
}

export function useScrollToBottom({
  messagesContainerRef,
  isLoading,
  pendingApprovalName,
}: UseScrollToBottomProps) {
  const { isAtBottom, scrollToBottom } = useIsAtBottom(messagesContainerRef);
  const isAtBottomRef = useRef(isAtBottom);

  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  // Scroll to bottom when the message list height changes
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container?.children[0]) {
      return;
    }
    const resizeObserver = new ResizeObserver(() => {
      if (isAtBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom());
      }
    });
    resizeObserver.observe(container);
    resizeObserver.observe(container.children[0]);
    return () => {
      resizeObserver.disconnect();
    }; // clean up
  }, [scrollToBottom, messagesContainerRef]);

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
  // IMPORTANT: we use pendingApprovalName to ensure that we scroll to the bottom when the approval name changes
  useLayoutEffect(() => {
    if (!isLoading && !!pendingApprovalName) {
      scrollToBottom(false);
    }
  }, [pendingApprovalName, isLoading, scrollToBottom]);
}
