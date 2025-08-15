// Modified from: https://github.com/TabbyML/tabby/blob/493cef3b3229548175de430dbc7f7e4a092ca507/clients/tabby-agent/src/http/tabbyApiClient.ts

import type { ApiClient } from "@/lib/auth-client";
import { getLogger } from "@/lib/logger";
import type {
  CodeCompletionRequest,
  CodeCompletionResponse,
} from "@ragdoll/common/pochi-api";
import { inject, injectable, singleton } from "tsyringe";
import type * as vscode from "vscode";
import { CodeCompletionConfig } from "./configuration";
import {
  HttpError,
  checkPaymentRequiredError,
  checkSubscriptionRequiredError,
  isCanceledError,
  isRateLimitExceededError,
  isTimeoutError,
  isUnauthorizedError,
} from "./utils/errors";

const logger = getLogger("CodeCompletion.Fetcher");

function createTimeOutSignal(): AbortSignal {
  return AbortSignal.timeout(CodeCompletionConfig.value.fetcher.timeout);
}

@injectable()
@singleton()
export class CompletionFetcher {
  private requestId = 0;

  constructor(
    @inject("ApiClient")
    private readonly apiClient: ApiClient,
  ) {}

  async fetchCompletion(
    request: CodeCompletionRequest,
    token?: vscode.CancellationToken | undefined,
    // set to track latency, the properties in latencyStats object will be updated in this function
    latencyStats?: {
      latency?: number; // ms, undefined means no data, timeout or canceled
      canceled?: boolean;
      timeout?: boolean;
    },
  ): Promise<CodeCompletionResponse> {
    const requestId = ++this.requestId;

    const signals = [createTimeOutSignal()];
    if (token) {
      const abortController = new AbortController();
      if (token.isCancellationRequested) {
        abortController.abort();
      }
      token.onCancellationRequested(() => abortController.abort());
      signals.push(abortController.signal);
    }

    const combinedSignal = AbortSignal.any(signals);

    const requestStartedAt = performance.now();
    try {
      logger.trace(`[${requestId}] Completion request:`, request);
      const response = await this.apiClient.api.code.completion.$post(
        {
          json: request,
        },
        {
          init: {
            signal: combinedSignal,
          },
        },
      );
      logger.trace(
        `[${requestId}] Completion response status: ${response.status}.`,
      );
      if (!response.ok) {
        throw new HttpError({
          status: response.status,
          statusText: response.statusText,
          text: await response.text(),
        });
      }
      const data = await response.json();
      logger.trace(`[${requestId}] Completion response data:`, data);

      if (latencyStats) {
        latencyStats.latency = performance.now() - requestStartedAt;
      }
      return data;
    } catch (error) {
      if (isCanceledError(error)) {
        logger.debug(`[${requestId}] Completion request canceled.`);
        if (latencyStats) {
          latencyStats.canceled = true;
        }
      } else if (isTimeoutError(error)) {
        logger.debug(`[${requestId}] Completion request timed out.`);
        if (latencyStats) {
          latencyStats.timeout = true;
        }
      } else if (isUnauthorizedError(error)) {
        logger.debug(
          `[${requestId}] Completion request failed due to unauthorized.`,
        );
      } else if (isRateLimitExceededError(error)) {
        logger.debug(
          `[${requestId}] Completion request failed due to rate limit exceeded.`,
        );
      } else if (checkPaymentRequiredError(error)) {
        logger.debug(
          `[${requestId}] Completion request failed due to payment required.`,
        );
      } else if (checkSubscriptionRequiredError(error)) {
        logger.debug(
          `[${requestId}] Completion request failed due to subscription required.`,
        );
      } else {
        logger.debug(`[${requestId}] Completion request failed.`, error);
      }

      if (latencyStats) {
        latencyStats.latency = undefined;
      }
      throw error; // rethrow error
    }
  }
}
