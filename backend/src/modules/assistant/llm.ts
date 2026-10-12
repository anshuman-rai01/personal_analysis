/**
 * Gemini LLM Adapter with thought signature preservation and exponential retry
 */

import 'dotenv/config';
import { GoogleGenAI, ApiError } from '@google/genai';
import { LLMClient, LLMGenerateParams, LLMGenerateResult, ToolCall } from './types.ts';

export type LLMErrorCategory = 'misconfiguration' | 'timeout' | 'busy' | 'generic';

export class AssistantLLMError extends Error {
  category: LLMErrorCategory;
  statusCode?: number;

  constructor(category: LLMErrorCategory, message: string, statusCode?: number) {
    super(message);
    this.name = 'AssistantLLMError';
    this.category = category;
    this.statusCode = statusCode;
  }
}

export const FRIENDLY_ERROR_MESSAGES: Record<LLMErrorCategory, string> = {
  misconfiguration: 'The assistant is currently not configured properly. Please ensure the GEMINI_API_KEY is configured.',
  timeout: 'The assistant request timed out while processing. Please try again.',
  busy: 'The assistant is busy right now. Please wait a moment and try again in a minute.',
  generic: 'Sorry, the assistant encountered an unexpected error while processing your request.',
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 429 || err.status === 503;
  }
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as any).status;
    return status === 429 || status === 503;
  }
  // Check for common transient network errors
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('fetch failed') ||
      msg.includes('network error')
    );
  }
  return false;
}

export function createGeminiClient(apiKey?: string): LLMClient {
  const resolvedApiKey = apiKey || process.env.GEMINI_API_KEY;

  return {
    async generate(params: LLMGenerateParams): Promise<LLMGenerateResult> {
      if (!resolvedApiKey) {
        throw new AssistantLLMError('misconfiguration', 'GEMINI_API_KEY is not configured');
      }

      const ai = new GoogleGenAI({
        apiKey: resolvedApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Construct base contents from messages
      let contents: any[] = [];
      if (params.rawContents && params.rawContents.length > 0) {
        // Multi-round conversation: use accumulated raw turns verbatim
        contents = [...params.rawContents];
      } else {
        // Initial round: build contents from user/assistant text history
        for (const msg of params.messages) {
          contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.text }],
          });
        }
      }

      const toolDeclarations = params.tools?.map(t => ({
        name: t.name,
        description: t.description,
        parametersJsonSchema: t.parametersJsonSchema,
      }));

      const config: any = {
        systemInstruction: params.system,
        automaticFunctionCalling: { disable: true },
      };

      if (toolDeclarations && toolDeclarations.length > 0) {
        config.tools = [{ functionDeclarations: toolDeclarations }];
      }

      const timeoutMs = parseInt(process.env.ASSISTANT_LLM_TIMEOUT_MS || '20000', 10);
      const isInitialRound = !params.rawContents || params.rawContents.length <= params.messages.length;

      // Model candidate cascade (only applicable at round 0 before model turns)
      const primaryModel = params.model || process.env.GEMINI_MODEL || 'gemini-3.6-flash';
      const candidateModels = isInitialRound
        ? [primaryModel, 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-flash-latest'].filter((m, i, arr) => arr.indexOf(m) === i)
        : [primaryModel];

      let lastError: unknown = null;

      for (const modelToTry of candidateModels) {
        // Attempt with retry on 429/503/network
        const isLastCandidate = !isInitialRound || candidateModels.indexOf(modelToTry) === candidateModels.length - 1;
        const delays = !isLastCandidate ? [1000] : [1500, 3000];
        let attempt = 0;

        while (attempt <= delays.length) {
          try {
            // AbortController for per-LLM-call timeout
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);

            try {
              const response = await ai.models.generateContent({
                model: modelToTry,
                contents,
                config: {
                  ...config,
                  abortSignal: controller.signal,
                },
              });

              clearTimeout(timer);

              const candidate = response.candidates?.[0];
              if (!candidate) {
                return { text: '' };
              }

              // Keep the EXACT raw candidate content object for round replay
              const rawTurn = candidate.content;
              const parts = candidate.content?.parts || [];

              const toolCalls: ToolCall[] = [];
              let textContent = '';

              for (const part of parts) {
                if (part.functionCall && part.functionCall.name) {
                  toolCalls.push({
                    name: part.functionCall.name,
                    args: (part.functionCall.args as Record<string, unknown>) || {},
                  });
                }
                if (part.text) {
                  textContent += part.text;
                }
              }

              return {
                text: textContent || undefined,
                toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                raw: rawTurn,
              };
            } finally {
              clearTimeout(timer);
            }
          } catch (err: any) {
            lastError = err;

            // Log failures strictly with error class name and status only (no prompt or text)
            const errName = err?.constructor?.name || 'Error';
            const status = err?.status || (err instanceof ApiError ? err.status : undefined);
            console.error(`[Assistant LLM] Generation attempt failed: model=${modelToTry} class=${errName} status=${status ?? 'none'}`);

            if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
              if (isLastCandidate) {
                throw new AssistantLLMError('timeout', 'LLM request timed out', 408);
              }
              // If not the last candidate, break out to try the next model candidate
              break;
            }

            if (isRetryable(err) && attempt < delays.length) {
              await sleep(delays[attempt]);
              attempt++;
              continue;
            }

            // Non-retryable or retries exhausted for this model
            break;
          }
        }

        // If this is round > 0, do not try other models
        if (!isInitialRound) break;
      }

      // Convert error to AssistantLLMError with sanitized category
      if (lastError instanceof ApiError) {
        if (lastError.status === 429 || lastError.status === 503) {
          throw new AssistantLLMError('busy', 'LLM service busy', lastError.status);
        }
        throw new AssistantLLMError('generic', 'Gemini API Error', lastError.status);
      }

      throw new AssistantLLMError('generic', 'LLM request failed');
    },
  };
}
