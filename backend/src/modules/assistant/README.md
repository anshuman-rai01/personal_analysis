# OmniLife Studio Assistant Architecture & Developer Guide

## 1. Overview & Architecture

The OmniLife Assistant replaces the legacy prompt-stuffed chatbot with a **RiskLens-style, tool-calling agentic loop**. It empowers users to chat, run personal analytics over their real data, visualize metrics and charts inside the chat stream, and prepare database records for confirmation.

### High-Level Architecture Flow

```
[User Input in Floating Widget]
        │
        ▼ (POST /api/assistant/chat { messages, clientDate })
[Express Router: src/routes/assistant.ts]
        │
        ├── requireAuth (adds authenticated: boolean)
        ├── Sliding-Window Rate Limiter (20 req/min/user)
        └── Request Validator (Hand-written, max 12 turns, 8000 chars total)
        │
        ▼
[Agent Loop: src/assistant/agent.ts] (Max 4 rounds, 45s deadline)
        │
   ┌────┴─────────────────────────────────────────────┐
   ▼                                                  ▼
[Gemini 3 SDK (automaticFunctionCalling: OFF)]    [Raw Content Cache]
   │                                                  ▲
   │ (Returns text OR function calls)                 │
   ├── If Text ──► Complete                           │
   └── If Tool Calls ─────────────────────────────────┤
        │                                             │
        ▼ (Replay candidate.content by identity) ─────┘
   [TOOL_REGISTRY (Concurrent Promise.all)]
        │
        ├── Read Tools (build_report, list_entries, get_forecast)
        │     └── Queries scoped strictly to req.user!.uid
        │
        └── Write Tools (propose_entry, propose_delete)
              ├── Checks authenticated || ASSISTANT_ALLOW_GUEST_WRITES
              └── ZERO Database Writes (generates structured confirmation cards)
        │
        ▼
   [Tool Result Split]
        ├── Data summary ──► Fed back to LLM for next turn
        └── Visual Blocks ──► Buffered directly for client response
        │
        ▼
[Client Response { id, text, blocks: Block[], outcome: 'ok'|'degraded'|'unavailable' }]
        │
        ▼
[AssistantWidget & BlockRenderer (React 19 + Recharts)]
        ├── MetricsBlock, ChartBlock, TableBlock, NoticeBlock
        └── ConfirmEntryBlock / ConfirmDeleteBlock
              │ (User presses "Save" or "Delete")
              ▼
   [Existing REST Endpoints: /api/finance, /api/study, /api/habits, /api/goals]
              │
              ├── Executes DB mutation & native goal side-effects
              ├── onDataChanged() triggers soft app refresh
              └── Appends truthful confirmation message to local conversation history
```

---

## 2. Core Architectural Principles

1. **Strict Separation of Computation and Summarization**:
   The LLM never computes arithmetic, statistics, or financial forecasts. Pure TypeScript tools query the database and execute deterministic algorithms. The LLM receives concise factual summaries, while rich structured visual `Block` objects are routed straight to the client.

2. **The LLM Never Writes Directly**:
   `propose_entry` and `propose_delete` perform zero database writes. They validate user intent against strict domain constraints, fill in server-side defaults, and emit `confirm_entry` or `confirm_delete` cards. A human click on the card executes the mutation via the existing, vetted REST endpoints.

3. **Goal Side Effects**:
   OmniLife Studio's existing endpoints include automated goal progression:
   - Creating a study session automatically increments all matching study goals.
   - Creating an investment or savings transaction automatically increments all matching finance goals.
   - Deleting study or finance entries does **not** reverse goal progress (existing route behavior).
   By delegating card submissions to the existing REST API, these side-effects remain intact and uniform.

4. **Thought Signature Preservation (Gemini 3)**:
   Gemini 3 models attach cryptographic `thoughtSignature` metadata to tool call parts. Modifying or reconstructing model turns causes Gemini to reject subsequent calls with `HTTP 400`. The adapter in `llm.ts` preserves `response.candidates[0].content` by object identity and passes it back verbatim during subsequent tool execution rounds.

5. **Indian Rupee (₹) Standard**:
   All monetary amounts use Indian Rupees (₹) with Indian digit grouping (e.g., `₹1,20,000`). Dollar currency symbols and non-INR formats are strictly prohibited.

---

## 3. Forecasting Methodology (`src/assistant/forecast.ts`)

The assistant uses an explainable, pure TypeScript forecasting engine operating over the user's personal `finance_transactions`:

1. **Daily Zero-Filled Series**:
   Sparse financial transactions are mapped onto a complete calendar date index from the first recorded date to `clientDate`. Days with no transactions are explicitly set to zero. (Fitting models only across active days causes sparse expense series to be overstated by up to +67%).
2. **Trailing Mean + Damped Trend**:
   Predictions use a trailing average across the last `min(60, availableDays)` days, combined with an optional damped linear trend slope. Predicted values are bounded strictly at zero (expenses and income cannot be negative).
3. **Reliability Tiers**:
   - **Insufficient Data (< 14 distinct transaction days)**: Returns `{ status: 'insufficient_data', requiredDays: 14 }` with a friendly notice block and no misleading totals.
   - **Low Confidence (14–27 distinct days)**: Returns point totals with an uncertainty disclaimer.
   - **Reliable (≥ 28 distinct days)**: Returns robust point estimates with standard deviation bands.
4. **Finances Series Netting**:
   When forecasting `series: 'finances'`, expenses and income are forecasted independently. `netPredicted` is calculated strictly in code (`incomeTotal - expenseTotal`). Overall reliability is the weaker of the two series.

---

## 4. How to Add a New Tool

To add a new tool to the assistant:

### Step 1: Implement the Tool Definition
Create your tool function in `src/assistant/tools/` implementing the `ToolDefinition` interface:

```typescript
import { ToolDefinition, ToolContext, ToolResult } from '../types.ts';

export const myNewTool: ToolDefinition = {
  declaration: {
    name: 'my_new_tool',
    description: 'Explain clearly to Gemini what this tool does and when to call it.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        filterParam: { type: 'string', description: 'Filter keyword' },
      },
      required: ['filterParam'],
    },
  },
  validateArgs: (args: Record<string, unknown>) => {
    if (typeof args.filterParam !== 'string' || !args.filterParam.trim()) {
      return { valid: false, errors: ['filterParam is required'] };
    }
    return { valid: true, sanitized: { filterParam: args.filterParam.trim() } };
  },
  execute: async (args: any, context: ToolContext): Promise<ToolResult> => {
    // Queries MUST always scope to context.uid:
    // const data = await db.select().where(eq(table.userId, context.uid));
    
    return {
      data: { status: 'ok', count: 1 },
      blocks: [
        // Optional visual blocks for the frontend
      ],
    };
  },
};
```

### Step 2: Register in `TOOL_REGISTRY`
In `src/assistant/tools/index.ts`, add your tool to `TOOL_REGISTRY`:

```typescript
import { myNewTool } from './myNewTool.ts';

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  // ... Existing tools
  my_new_tool: myNewTool,
};
```

### Step 3: Write Unit Tests
Add tests in `src/assistant/` using Node's built-in test runner (`node:test`) asserting parameter validation, user-scoping, and output structures.

---

## 5. How to Add a New Visual Block Type

Structured blocks enable rich visual responses inside the chat without Markdown parsing ambiguities:

### Step 1: Update the Block Type Definitions
Add the new block type to `Block` in `src/assistant/types.ts` and mirror it in `src/lib/assistantTypes.ts`:

```typescript
export type Block =
  | ExistingBlocks
  | {
      type: 'kpi_gauge';
      id: string;
      title: string;
      score: number;
      maxScore: number;
    };
```

### Step 2: Create a Block Builder Helper
In `src/assistant/blocks.ts`, export a pure builder function:

```typescript
export function createKpiGaugeBlock(id: string, title: string, score: number, maxScore: number): Block {
  return { type: 'kpi_gauge', id, title, score, maxScore };
}
```

### Step 3: Implement the UI Component
Create `src/components/assistant/KpiGaugeBlock.tsx` and register it in `src/components/assistant/BlockRenderer.tsx`:

```tsx
case 'kpi_gauge':
  return <KpiGaugeBlock block={block} />;
```

---

## 6. Security & Guest-Write Policy

### Request Identification
All database queries and mutations derive user identity solely from `req.user!.uid` provided by `requireAuth`. The model has no access to user IDs and cannot pass IDs to tools.

### Guest-Write Risk Notice (`ASSISTANT_ALLOW_GUEST_WRITES`)
- In OmniLife Studio, unauthenticated requests fall back to an unverified guest identity (`x-guest-uid` header or `default_user_101`).
- By default, **guest writes and deletions are prohibited** (`ASSISTANT_ALLOW_GUEST_WRITES=false`). When unauthenticated guests attempt to propose changes, the assistant prompts them to sign in.
- Setting `ASSISTANT_ALLOW_GUEST_WRITES=true` allows demo or guest users to prepare writes and deletions. **Warning**: On untrusted networks, anyone providing the same guest ID can modify the associated records. This flag should only be enabled on trusted demonstration workstations.
