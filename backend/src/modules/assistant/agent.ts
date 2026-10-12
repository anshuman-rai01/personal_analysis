/**
 * Agent execution loop for the OmniLife Assistant
 */

import { randomUUID } from 'crypto';
import {
  LLMClient,
  LLMMessage,
  ToolContext,
  ToolDefinition,
  Block,
  AssistantChatResponse,
} from './types.ts';
import { buildSystemPrompt } from './prompts.ts';
import { AssistantLLMError, FRIENDLY_ERROR_MESSAGES } from './llm.ts';
import { validateBlocks } from './validate.ts';

export interface RunAgentOptions {
  messages: LLMMessage[];
  clientDate: string;
  context: ToolContext;
  llm: LLMClient;
  tools?: Record<string, ToolDefinition>;
  maxRounds?: number;
  deadlineMs?: number;
}

export async function runAgent(options: RunAgentOptions): Promise<AssistantChatResponse> {
  const responseId = randomUUID();
  const maxRounds = options.maxRounds ?? 4;
  const deadlineMs =
    options.deadlineMs ??
    parseInt(process.env.ASSISTANT_REQUEST_DEADLINE_MS || '45000', 10);
  const startTime = Date.now();

  const systemPrompt = buildSystemPrompt(options.clientDate);
  const toolRegistry = options.tools || {};
  const toolDeclarations = Object.values(toolRegistry).map(t => t.declaration);

  const collectedBlocks: Block[] = [];
  let proposeActionExecuted = false;

  // Build initial rawContents array for thoughtSignature preservation across rounds
  const rawContents: any[] = options.messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.text }],
  }));

  try {
    for (let round = 0; round < maxRounds; round++) {
      // Check deadline
      if (Date.now() - startTime > deadlineMs) {
        return {
          id: responseId,
          text: FRIENDLY_ERROR_MESSAGES.timeout,
          blocks: collectedBlocks,
          outcome: 'unavailable',
        };
      }

      const llmResult = await options.llm.generate({
        system: systemPrompt,
        messages: options.messages,
        tools: toolDeclarations.length > 0 ? toolDeclarations : undefined,
        rawContents,
      });

      // If no tool calls were requested, we are done
      if (!llmResult.toolCalls || llmResult.toolCalls.length === 0) {
        const text = llmResult.text || '';
        const blockValidation = validateBlocks(collectedBlocks);
        return {
          id: responseId,
          text,
          blocks: blockValidation.valid ? collectedBlocks : [],
          outcome: 'ok',
        };
      }

      // Preserve the EXACT raw candidate content object for Gemini 3 thoughtSignature
      rawContents.push(llmResult.raw);

      // Execute tool calls for this round
      const toolCalls = llmResult.toolCalls;

      // Group identical calls to execute once, but preserve response for every call
      const executionMap = new Map<string, Promise<{ data: Record<string, unknown>; blocks?: Block[]; status: string }>>();
      const callKeys: string[] = [];

      for (const call of toolCalls) {
        const callKey = `${call.name}:${JSON.stringify(call.args)}`;
        callKeys.push(callKey);

        if (!executionMap.has(callKey)) {
          const isPropose = call.name.startsWith('propose_');
          if (isPropose && proposeActionExecuted) {
            executionMap.set(
              callKey,
              Promise.resolve({
                data: { status: 'error', error: 'one_action_at_a_time' },
                status: 'error',
              })
            );
            continue;
          }

          if (isPropose) {
            proposeActionExecuted = true;
          }

          const toolDef = toolRegistry[call.name];
          if (!toolDef) {
            executionMap.set(
              callKey,
              Promise.resolve({
                data: { status: 'error', error: 'unknown_tool', tool: call.name },
                status: 'error',
              })
            );
            continue;
          }

          // Validate arguments
          const argValidation = toolDef.validateArgs(call.args);
          if (!argValidation.valid) {
            executionMap.set(
              callKey,
              Promise.resolve({
                data: {
                  status: 'error',
                  error: 'invalid_arguments',
                  fields: argValidation.errors || ['Invalid argument schema'],
                },
                status: 'error',
              })
            );
            continue;
          }

          // Execute with a 30s timeout
          const execPromise = (async () => {
            const toolStart = Date.now();
            let toolOutcome = 'ok';
            try {
              const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Tool timeout')), 30000)
              );
              const result = await Promise.race([
                toolDef.execute(argValidation.sanitized || call.args, options.context),
                timeoutPromise,
              ]);

              if (result.blocks && result.blocks.length > 0) {
                for (const b of result.blocks) {
                  if (collectedBlocks.length < 6) {
                    collectedBlocks.push(b);
                  }
                }
              }

              const status = (result.data?.status as string) || 'ok';
              toolOutcome = status;
              return { data: result.data, blocks: result.blocks, status: toolOutcome };
            } catch (err: any) {
              toolOutcome = err?.message === 'Tool timeout' ? 'timeout' : 'error';
              return {
                data: { status: 'error', error: err?.message || 'Tool execution failure' },
                status: toolOutcome,
              };
            } finally {
              const durationMs = Date.now() - toolStart;
              // Log tool name, duration, and outcome ONLY (never log arguments, data, titles, or prompt)
              console.log(`[Assistant Tool] tool=${call.name} duration=${durationMs}ms outcome=${toolOutcome}`);
            }
          })();

          executionMap.set(callKey, execPromise);
        }
      }

      // Await all unique executions concurrently
      const executedResults = await Promise.all(
        callKeys.map(key => executionMap.get(key)!)
      );

      // Return all tool results of the round as ONE user-role Content whose parts are functionResponse
      // in the exact same order as the calls
      const toolResponseParts = toolCalls.map((call, idx) => ({
        functionResponse: {
          name: call.name,
          response: executedResults[idx].data,
        },
      }));

      rawContents.push({
        role: 'user',
        parts: toolResponseParts,
      });
    }

    // Loop cap exceeded (maxRounds reached) -> outcome: 'degraded'
    const blockValidation = validateBlocks(collectedBlocks);
    return {
      id: responseId,
      text: 'I have gathered the available analytics data for your request, but could not complete all follow-up steps.',
      blocks: blockValidation.valid ? collectedBlocks : [],
      outcome: 'degraded',
    };
  } catch (err: any) {
    if (err instanceof AssistantLLMError) {
      return {
        id: responseId,
        text: FRIENDLY_ERROR_MESSAGES[err.category] || FRIENDLY_ERROR_MESSAGES.generic,
        blocks: [],
        outcome: 'unavailable',
      };
    }

    console.error(`[Assistant Loop] Unexpected error: ${err?.name || 'Error'}`);
    return {
      id: responseId,
      text: FRIENDLY_ERROR_MESSAGES.generic,
      blocks: [],
      outcome: 'unavailable',
    };
  }
}
