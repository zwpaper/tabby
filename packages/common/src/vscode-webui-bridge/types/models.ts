/**
 * Custom model setting
 */
export type CustomModelSetting = {
  /**
   * Model provider identifier, e.g., "openai", "anthropic", etc.
   */
  id: string;
  /**
   * Model provider name, e.g., "OpenAI", "Anthropic", etc.
   * This is used for display purposes in the UI. If not provided, the `id` will be used.
   */
  name?: string;
  /**
   * Base URL for the model provider's API, e.g., "https://api.openai.com/v1"
   * This is used to make API requests to the model provider.
   */
  baseURL: string;
  /**
   *  API key for the model provider, if required.
   */
  apiKey?: string;
  models: {
    /**
     * Display name of the model, e.g., "GPT-4o".
     * This is used for display purposes in the UI. If not provided, the `id` will be used.
     */
    name?: string;
    /**
     * Identifier for the model, e.g., "gpt-4o".
     * This is used to identify the model in API requests.
     */
    id: string;
    /**
     * Maximum number of generated tokens for the model
     */
    maxTokens: number;
    /**
     * Context window size for the model
     */
    contextWindow: number;
  }[];
};

export type PochiModelsSettings = {
  modelEndpointId?: string;
};
