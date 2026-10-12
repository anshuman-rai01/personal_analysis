import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAgent } from './agent.ts';
import { LLMClient, LLMGenerateParams, LLMGenerateResult, ToolDefinition, NoticeBlock } from './types.ts';
import { AssistantLLMError } from './llm.ts';

class ScriptedFakeLLM implements LLMClient {
  private script: LLMGenerateResult[];
  public calls: LLMGenerateParams[] = [];

  constructor(script: LLMGenerateResult[]) {
    this.script = [...script];
  }

  async generate(params: LLMGenerateParams): Promise<LLMGenerateResult> {
    this.calls.push(params);
    const next = this.script.shift();
    if (!next) {
      return { text: 'Default fallback response' };
    }
    return next;
  }
}

describe('Agent Loop with Scripted Fake LLM', () => {
  const dummyContext = {
    uid: 'user_test_1',
    authenticated: true,
    clientDate: '2026-10-10',
  };

  it('handles direct no-tool answer', async () => {
    const fakeLLM = new ScriptedFakeLLM([
      { text: 'Hello! How can I help you today?', raw: { role: 'model', parts: [{ text: 'Hello!' }] } },
    ]);

    const res = await runAgent({
      messages: [{ role: 'user', text: 'Hello' }],
      clientDate: '2026-10-10',
      context: dummyContext,
      llm: fakeLLM,
    });

    assert.equal(res.outcome, 'ok');
    assert.equal(res.text, 'Hello! How can I help you today?');
    assert.equal(res.blocks.length, 0);
    assert.equal(fakeLLM.calls.length, 1);
  });

  it('replays raw model turn by exact object identity', async () => {
    const rawTurnObject = {
      role: 'model',
      parts: [
        {
          thoughtSignature: 'sig_xyz123',
          functionCall: { name: 'test_tool', args: { val: 42 } },
        },
      ],
    };

    const fakeLLM = new ScriptedFakeLLM([
      { toolCalls: [{ name: 'test_tool', args: { val: 42 } }], raw: rawTurnObject },
      { text: 'Final answer after tool', raw: { role: 'model', parts: [{ text: 'Final' }] } },
    ]);

    const tools: Record<string, ToolDefinition> = {
      test_tool: {
        declaration: {
          name: 'test_tool',
          description: 'A test tool',
          parametersJsonSchema: { type: 'object' },
        },
        validateArgs: () => ({ valid: true }),
        execute: async () => ({ data: { status: 'ok', value: 42 } }),
      },
    };

    const res = await runAgent({
      messages: [{ role: 'user', text: 'Run tool' }],
      clientDate: '2026-10-10',
      context: dummyContext,
      llm: fakeLLM,
      tools,
    });

    assert.equal(res.outcome, 'ok');
    assert.equal(fakeLLM.calls.length, 2);

    // Assert that round 2 received the EXACT raw turn object reference from round 1
    const secondCallContents = fakeLLM.calls[1].rawContents;
    assert.ok(secondCallContents);
    // secondCallContents should be [user_initial, rawTurnObject, user_tool_result]
    assert.equal(secondCallContents[1], rawTurnObject, 'The replayed model turn must match by object identity');
  });

  it('collects blocks and feeds tool data back to LLM', async () => {
    const dummyNotice: NoticeBlock = {
      type: 'notice',
      id: 'notice_1',
      tone: 'info',
      text: 'Sample notice block',
    };

    const fakeLLM = new ScriptedFakeLLM([
      {
        toolCalls: [{ name: 'report_tool', args: {} }],
        raw: { role: 'model', parts: [{ functionCall: { name: 'report_tool', args: {} } }] },
      },
      { text: 'Here is your report', raw: { role: 'model', parts: [{ text: 'Here' }] } },
    ]);

    const tools: Record<string, ToolDefinition> = {
      report_tool: {
        declaration: {
          name: 'report_tool',
          description: 'Report tool',
          parametersJsonSchema: { type: 'object' },
        },
        validateArgs: () => ({ valid: true }),
        execute: async () => ({
          data: { status: 'ok', total: 500 },
          blocks: [dummyNotice],
        }),
      },
    };

    const res = await runAgent({
      messages: [{ role: 'user', text: 'Give report' }],
      clientDate: '2026-10-10',
      context: dummyContext,
      llm: fakeLLM,
      tools,
    });

    assert.equal(res.outcome, 'ok');
    assert.equal(res.blocks.length, 1);
    assert.equal(res.blocks[0].type, 'notice');
    assert.equal((res.blocks[0] as NoticeBlock).text, 'Sample notice block');
  });

  it('executes parallel tool calls concurrently', async () => {
    let toolAExecuted = false;
    let toolBExecuted = false;

    const fakeLLM = new ScriptedFakeLLM([
      {
        toolCalls: [
          { name: 'tool_a', args: {} },
          { name: 'tool_b', args: {} },
        ],
        raw: { role: 'model', parts: [] },
      },
      { text: 'Both executed', raw: { role: 'model', parts: [] } },
    ]);

    const tools: Record<string, ToolDefinition> = {
      tool_a: {
        declaration: { name: 'tool_a', description: 'A', parametersJsonSchema: {} },
        validateArgs: () => ({ valid: true }),
        execute: async () => {
          toolAExecuted = true;
          return { data: { resA: 1 } };
        },
      },
      tool_b: {
        declaration: { name: 'tool_b', description: 'B', parametersJsonSchema: {} },
        validateArgs: () => ({ valid: true }),
        execute: async () => {
          toolBExecuted = true;
          return { data: { resB: 2 } };
        },
      },
    };

    const res = await runAgent({
      messages: [{ role: 'user', text: 'Run parallel' }],
      clientDate: '2026-10-10',
      context: dummyContext,
      llm: fakeLLM,
      tools,
    });

    assert.equal(res.outcome, 'ok');
    assert.equal(toolAExecuted, true);
    assert.equal(toolBExecuted, true);
  });

  it('handles invalid arguments with error feedback and subsequent recovery', async () => {
    let recoveryExecuted = false;

    const fakeLLM = new ScriptedFakeLLM([
      // Round 1: Model calls tool with invalid args
      {
        toolCalls: [{ name: 'strict_tool', args: { amount: -50 } }],
        raw: { role: 'model', parts: [] },
      },
      // Round 2: Model recovers with valid args
      {
        toolCalls: [{ name: 'strict_tool', args: { amount: 50 } }],
        raw: { role: 'model', parts: [] },
      },
      // Round 3: Model answers
      { text: 'Success after recovery', raw: { role: 'model', parts: [] } },
    ]);

    const tools: Record<string, ToolDefinition> = {
      strict_tool: {
        declaration: { name: 'strict_tool', description: 'Strict', parametersJsonSchema: {} },
        validateArgs: args => {
          if (typeof args.amount === 'number' && args.amount > 0) {
            return { valid: true };
          }
          return { valid: false, errors: ['amount must be positive'] };
        },
        execute: async args => {
          recoveryExecuted = true;
          return { data: { status: 'ok', amount: args.amount } };
        },
      },
    };

    const res = await runAgent({
      messages: [{ role: 'user', text: 'Do strict' }],
      clientDate: '2026-10-10',
      context: dummyContext,
      llm: fakeLLM,
      tools,
    });

    assert.equal(res.outcome, 'ok');
    assert.equal(recoveryExecuted, true);
    assert.equal(fakeLLM.calls.length, 3);
  });

  it('handles unknown tool gracefully without crashing', async () => {
    const fakeLLM = new ScriptedFakeLLM([
      {
        toolCalls: [{ name: 'hallucinated_tool', args: {} }],
        raw: { role: 'model', parts: [] },
      },
      { text: 'I apologize, that tool is not available.', raw: { role: 'model', parts: [] } },
    ]);

    const res = await runAgent({
      messages: [{ role: 'user', text: 'Call bad tool' }],
      clientDate: '2026-10-10',
      context: dummyContext,
      llm: fakeLLM,
      tools: {},
    });

    assert.equal(res.outcome, 'ok');
    assert.match(res.text, /not available/i);
  });

  it('deduplicates identical calls while returning one response each in order', async () => {
    let executionCount = 0;

    const fakeLLM = new ScriptedFakeLLM([
      {
        toolCalls: [
          { name: 'cached_tool', args: { id: 10 } },
          { name: 'cached_tool', args: { id: 10 } },
        ],
        raw: { role: 'model', parts: [] },
      },
      { text: 'Done duplicate check', raw: { role: 'model', parts: [] } },
    ]);

    const tools: Record<string, ToolDefinition> = {
      cached_tool: {
        declaration: { name: 'cached_tool', description: 'Cached', parametersJsonSchema: {} },
        validateArgs: () => ({ valid: true }),
        execute: async () => {
          executionCount++;
          return { data: { status: 'ok', computed: 999 } };
        },
      },
    };

    const res = await runAgent({
      messages: [{ role: 'user', text: 'Test duplicate' }],
      clientDate: '2026-10-10',
      context: dummyContext,
      llm: fakeLLM,
      tools,
    });

    assert.equal(res.outcome, 'ok');
    assert.equal(executionCount, 1, 'Tool should only be executed once for duplicate calls');

    // Verify round 2 received 2 functionResponse parts
    const secondCallContents = fakeLLM.calls[1].rawContents;
    const responseContent = secondCallContents?.[2];
    assert.equal(responseContent.parts.length, 2);
    assert.equal(responseContent.parts[0].functionResponse.response.computed, 999);
    assert.equal(responseContent.parts[1].functionResponse.response.computed, 999);
  });

  it('returns degraded outcome with collected blocks when loop cap is reached', async () => {
    const dummyNotice: NoticeBlock = {
      type: 'notice',
      id: 'loop_notice',
      tone: 'warn',
      text: 'Collected in early round',
    };

    // A model that loops endlessly calling infinite_tool
    const loopingScript = Array.from({ length: 6 }, () => ({
      toolCalls: [{ name: 'infinite_tool', args: {} }],
      raw: { role: 'model', parts: [] },
    }));

    const fakeLLM = new ScriptedFakeLLM(loopingScript);

    const tools: Record<string, ToolDefinition> = {
      infinite_tool: {
        declaration: { name: 'infinite_tool', description: 'Infinite', parametersJsonSchema: {} },
        validateArgs: () => ({ valid: true }),
        execute: async () => ({
          data: { status: 'ok' },
          blocks: [dummyNotice],
        }),
      },
    };

    const res = await runAgent({
      messages: [{ role: 'user', text: 'Loop me' }],
      clientDate: '2026-10-10',
      context: dummyContext,
      llm: fakeLLM,
      tools,
      maxRounds: 4,
    });

    assert.equal(res.outcome, 'degraded');
    assert.equal(res.blocks.length >= 1, true);
  });

  it('handles LLM failure or missing configuration returning outcome: unavailable', async () => {
    const failingLLM: LLMClient = {
      generate: async () => {
        throw new AssistantLLMError('misconfiguration', 'GEMINI_API_KEY is not configured');
      },
    };

    const res = await runAgent({
      messages: [{ role: 'user', text: 'Hi' }],
      clientDate: '2026-10-10',
      context: dummyContext,
      llm: failingLLM,
    });

    assert.equal(res.outcome, 'unavailable');
    assert.match(res.text, /not configured/i);
    assert.equal(res.blocks.length, 0);
  });
});
