import { createToolMiddleware } from "./tool-call-middleware";

const defaultToolMiddleware = createToolMiddleware();

export { defaultToolMiddleware, createToolMiddleware };
