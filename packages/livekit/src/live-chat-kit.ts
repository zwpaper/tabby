import type { ChatInit, ChatOnFinishCallback } from "@ai-v5-sdk/ai";
import type { Store } from "@livestore/livestore";
import {
  FlexibleChatTransport,
  type OnStartCallback,
} from "./flexible-chat-transport";
import { messageSeq$, messages$ } from "./store/queries";
import { events } from "./store/schema";
import type { Message } from "./types";

export class LiveChatKit<T> {
  readonly chat: T;

  constructor(
    private readonly store: Store,
    private readonly taskId: string,
    chatClass: new (options: ChatInit<Message>) => T,
  ) {
    this.chat = new chatClass({
      messages: this.store.query(messages$).map((x) => x.data as Message),
      generateId: () => crypto.randomUUID(),
      onFinish: this.onFinish,
      transport: this.transport,
    });
  }

  private readonly onStart: OnStartCallback = ({ messages }) => {
    const { store, taskId } = this;
    const lastMessage = messages.at(-1);
    if (lastMessage?.role === "user") {
      store.commit(
        events.messageUpdated({
          taskId,
          seq: store.query(messageSeq$(taskId, lastMessage.id)),
          data: lastMessage,
        }),
      );
    }
  };

  private readonly transport = new FlexibleChatTransport({
    onStart: this.onStart,
  });

  private readonly onFinish: ChatOnFinishCallback<Message> = ({ message }) => {
    const { store, taskId } = this;
    store.commit(
      events.messageUpdated({
        taskId,
        seq: store.query(messageSeq$(taskId, message.id)),
        data: message,
      }),
    );
  };
}
