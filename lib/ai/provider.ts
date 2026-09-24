import "server-only";

/**
 * AI provider abstraction (see AI ARCHITECTURE). No provider SDK is called
 * directly from anywhere else in the app — everything goes through
 * `AiProvider`, so swapping Anthropic/OpenAI/Replicate later touches one
 * file. API keys are read from environment variables only and this module
 * is marked server-only, so it cannot be imported into client code.
 */

export interface AiMessageInput {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCompletionRequest {
  messages: AiMessageInput[];
  maxTokens?: number;
  temperature?: number;
}

export interface AiCompletionResult {
  content: string;
  provider: string;
  model: string;
}

export interface AiProvider {
  readonly name: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}

/**
 * Throws until a real provider is wired up. Prompt 5 implements a concrete
 * provider (e.g. AnthropicProvider) and this factory returns it instead.
 * Keeping this as an explicit failure — rather than a silent mock — means
 * nothing can accidentally ship believing it's talking to a real model.
 */
function createUnconfiguredProvider(): AiProvider {
  return {
    name: "unconfigured",
    async complete() {
      throw new Error(
        "No AI provider is configured yet. This is expected in Prompt 1 — " +
          "Prompt 5 (AI Code Mentor) implements a real AiProvider and wires " +
          "it up here via environment variables.",
      );
    },
  };
}

let cachedProvider: AiProvider | null = null;

export function getAiProvider(): AiProvider {
  if (!cachedProvider) {
    cachedProvider = createUnconfiguredProvider();
  }
  return cachedProvider;
}
