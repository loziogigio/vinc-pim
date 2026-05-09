# ELIA Agentic Chat — Design

> Evolve ELIA from a stateless 3-step search pipeline into a multi-turn intelligent advisor with tool use, vector knowledge retrieval, and a wide-recall product funnel.

**Status:** Planning
**Last Updated:** 2026-04-29
**Related:** `doc/02-api/elia-api.md` (current 3-step pipeline)

---

## 1. Context

ELIA today is a stateless 3-step pipeline (`/api/elia/intent` → `/api/elia/search` → `/api/elia/analyze`) wrapped in a chat skin. Every new user message calls `handleReset()` in `vinc-b2b/src/components/elia/elia-drawer.tsx:343`, so there is zero conversation memory and Claude is forced (`tool_choice: { type: 'tool' }`) into the `extract_intent` tool on every turn.

The customer-driving example: **"Devo riparare un tubo zincato da un foro che causa una perdita…consigliami come farlo"**. Today ELIA searches `tubo zincato foro perdita` and returns galvanized pipes — wrong answer. The customer wants advisory reasoning that *leads* to products: 2–3 repair approaches (fascetta riparatubi, resina epossidica, sostituzione), follow-up questions on diameter / hole size / available tools, then product groups per approach.

Two design constraints have been opened up explicitly:
1. The data format / storage shape may change.
2. Vector storage is allowed if it helps.

This plan exploits both. The current 3 endpoints stay intact for any other consumer; the agent uses the underlying service functions directly.

---

## 2. Goals

1. **Multi-turn memory** — every turn sees prior turns, prior intents, prior product candidates, prior user-provided facts.
2. **Agent loop with optional tool use** — Claude decides per turn whether to answer, ask, search, recall, or finalize. Not forced into search.
3. **Rich content blocks** — one assistant turn may contain text + N tool calls + product groups + clarification chips + suggestion chips.
4. **Streaming UX** — SSE; tokens, reasoning steps, and product groups appear incrementally.
5. **RAG over a tenant knowledge base** — repair / sizing / troubleshooting docs are vector-retrievable so advisory answers are grounded, not hallucinated.
6. **Conversation recall** — semantic retrieval over prior turns so older context isn't lost when the message-history budget runs out.
7. **Wide-recall product funnel** — analyze must see far more candidates than today's ~20. Hybrid retrieval (keyword + vector) + RRF + LLM rerank, so the right product isn't filtered out before the LLM ever looks at it.
8. **Persistence + tenant isolation** — Mongo per-tenant DB pattern already in place; conversations survive reload and instance restart.
9. **Cost-aware** — Haiku for simple turns; Sonnet only for advisory or after several iterations.
10. **Italian-first**, English second.

---

## 3. Architecture overview

```
                    POST /api/elia/chat   (SSE)
                            │
      ┌─────────────────────┼─────────────────────┐
      │                     │                     │
  load conv +         runAgentTurn()         persist new turn
  build msg history   (Anthropic stream,     + updated AgentState
  + AgentState        tool_choice: auto,     + embeddings
                       max 5 iterations)
                            │
   ┌────────┬──────────┬────┼──────────┬─────────────┬─────────────┐
   │        │          │    │          │             │             │
search_   analyze_  retrieve_  recall_    propose_   ask_        finalize_
products  products  knowledge  convers.   repair_    clarif.     recommend.
(funnel   (Claude   (vector    (vector    approach.  (pure       (composes
 §5)      ranking)   over KB)  over turns) (pure)    Claude)     groups)
```

- **Outer agent** (in `/api/elia/chat`): `tool_choice: 'auto'`, advisor system prompt, multi-iteration loop, SSE.
- **Inner services** kept unchanged — `extractSearchIntent()`, `cascadeSearch()`, `analyzeProducts()` still use forced tool_use internally. The agent calls them via tool handlers.
- **Knowledge & memory** in MongoDB Atlas Vector Search (or self-hosted equivalent), per tenant DB.

---

## 4. Data model

New file: `src/lib/types/elia-chat.ts`.

```ts
export type EliaToolName =
  | 'search_products' | 'analyze_products' | 'get_product_details'
  | 'retrieve_knowledge' | 'recall_conversation'
  | 'propose_repair_approaches' | 'ask_clarification' | 'finalize_recommendation';

export type EliaContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; tool_use_id: string; name: EliaToolName; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; is_error?: boolean;
      content: { type: 'text'; text: string }[] }
  | { type: 'product_group'; group_id: string; title: string; subtitle?: string;
      approach_tag?: string;
      products: Array<{ entity_code: string; analyzed?: AnalyzedProduct }>;
      source_tool_use_id?: string }
  | { type: 'clarification'; question: string; multi_select?: boolean;
      options: Array<{ id: string; label: string; value: string }> }
  | { type: 'suggestion'; suggestions: Array<{ id: string; label: string; prompt: string }> }
  | { type: 'reasoning_step'; phase: string; label: string; detail?: string;
      keywords?: string[]; status: 'active' | 'completed' | 'error' }
  | { type: 'citation'; doc_id: string; chunk_id: string; title: string; url?: string };

export interface EliaTurn {
  turn_id: string; conversation_id: string; index: number;
  role: 'user' | 'assistant' | 'system';
  blocks: EliaContentBlock[];           // Anthropic-faithful — replayable as message history
  user_text?: string;
  model_used?: 'haiku' | 'sonnet';
  iterations?: number;
  input_tokens?: number; output_tokens?: number;
  finish_reason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  embedding?: number[];                 // populated for user turns + assistant summaries
  embedding_model?: string;
  created_at: Date;
}

export interface EliaAgentState {
  current_intent: EliaIntentExtraction | null;
  product_shortlist: Array<{ entity_code: string; name?: string; brand_name?: string;
    price?: number; last_seen_turn: number; approach_tag?: string }>;          // cap 30
  open_clarifications: Array<{ turn_index: number; question_id: string; question: string }>;
  proposed_approaches: Array<{ approach_tag: string; title: string; pros?: string[];
    cons?: string[]; constraints?: Record<string, unknown>; turn_index: number }>;
  user_facts: Record<string, unknown>;  // {pipe_diameter:'15mm', has_welder:false,...}
  rolling_summary?: string;             // refreshed every N turns; injected when history is trimmed
}

export interface EliaConversation {
  conversation_id: string; tenant_id: string;
  owner: { user_id?: string; session_id: string; locale: 'it' | 'en' };
  title?: string; status: 'open' | 'archived';
  agent_state: EliaAgentState;
  turn_count: number; last_turn_at?: Date;
  created_at: Date; updated_at: Date;
}

export interface EliaKnowledgeChunk {
  _id: string; tenant_id: string;
  doc_id: string; doc_title: string; doc_url?: string;
  chunk_index: number; chunk_text: string;
  metadata: { category?: string; product_class?: string;
    approach_tag?: string; language: 'it' | 'en' };
  embedding: number[];                   // 1024 (voyage-3) or 1536 (openai-3-small)
  embedding_model: string;
  updated_at: Date;
}
```

### Storage choice — MongoDB per-tenant DB

Three new collections beside `threads` (`src/lib/db/models/thread.ts`):

- `elia_conversations` — light, per-conversation state; indexes `(tenant_id, owner.session_id, last_turn_at)` and `(tenant_id, owner.user_id, last_turn_at)`.
- `elia_turns` — heavy; indexes `(conversation_id, index)`, `(conversation_id, created_at)`, plus `vectorIndex` on `embedding` for conversation recall.
- `elia_knowledge_chunks` — RAG corpus; `vectorIndex` on `embedding` filtered by `tenant_id` + `metadata.language`.

Rationale for splitting turns out of the conversation doc: an active advisory chat with 50+ turns + product snapshots blows the BSON 16 MB limit. Splitting also lets us add the vector index only on the turns collection without bloating the conversation doc.

If the production Mongo is **not** Atlas / lacks vector search, fallback is a small **Qdrant** instance keyed by `tenant_id` collection name; the rest of the design is unchanged. Decision deferred to env probe (see §10).

---

## 5. Tool catalogue

| Tool | Wraps | Notes |
|---|---|---|
| `search_products` | `extractSearchIntent()` (intent.service.ts:86) + the new wide-recall funnel (§6) | Input `{query, refine_with?, top_k?}`. Sends Claude only the post-rerank top-10 with key attributes (not full Solr docs) to save tokens. |
| `analyze_products` | `analyzeProducts()` (claude.service.ts:403) | Gated on `isAuthorized`. Operates on the rerank top-10 (Stage 4 of the funnel). Uses extracted `product-merge.ts` helper. |
| `get_product_details` | reuses `searchProducts(entity_code)` from `app/api/elia/analyze/route.ts:85-149` | "Tell me more about the first one". |
| `retrieve_knowledge` | **vector search** over `elia_knowledge_chunks` | Embeds query, top-K by tenant + language; returns `{chunks, citations}`. Citations flow back to UI. |
| `recall_conversation` | **vector search** over `elia_turns.embedding` | Used when message history budget can't fit older turns. Top-K with score floor. |
| `propose_repair_approaches` | pure Claude reasoning | Side effect: writes to `agent_state.proposed_approaches`; emits `text` + `suggestion` chips. |
| `ask_clarification` | pure Claude reasoning | Emits `clarification` block + records in `agent_state.open_clarifications`. |
| `finalize_recommendation` | composer | Emits one or more `product_group` blocks pulling from shortlist or fresh searches. Closes the turn. |

Tool schemas live in `src/lib/elia/agent/tools.ts` as JSON-Schema literals (same pattern as `EliaIntentExtractionSchema` at `src/lib/types/elia.ts:126`).

---

## 6. Wide-recall analysis funnel

Today's `cascadeSearch` returns ≤20 products and `analyzeProducts` only ever sees those. If the keyword cascade missed the right product (different terminology in the index, abbreviations, brand-vs-generic naming), the LLM cannot rescue it. Replace the single-stage retrieval with a four-stage funnel; only the last two stages spend LLM tokens.

### 6.1 Stage 1 — Wide recall (target: 200–500 candidates, no LLM)

Run two retrievers in parallel and union/dedup by `entity_code`:

- **Keyword cascade** — today's `cascadeSearch()` (`src/lib/elia/search.service.ts:97`), but with `maxResults: 200` (currently 20) and the cascade allowed to keep going past the threshold.
- **Vector retrieval** — embed the user query (or the `intent.user_message` field, which is a Claude-rewritten cleaner version), then top-200 by cosine over a product-embedding field.

For the vector field, two viable options:

1. **Solr 9.x `dense_vector` field** on the existing core. Index a per-product `embedding` (1024 dims, voyage-3) computed at PIM ingestion time. Pro: no new infrastructure, hybrid retrieval in one round-trip via Solr's `{!knn f=embedding}` parser. Con: requires reindex.
2. **Sidecar Qdrant collection per tenant** with `entity_code` as payload. Pro: faster to roll out, no Solr schema change. Con: second system to operate, extra latency.

Default to option 1 if Solr 9.x is in production; otherwise option 2 as a 2-week bridge.

Apply hard filters (`tenant_id`, `language`, `price_min/max` from intent, `stock_filter`) at this stage so downstream stages don't waste cycles.

### 6.2 Stage 2 — Deterministic pre-rank with RRF (drop to 50, no LLM)

Compute three independent rankings of the unioned candidate pool:

- `rank_keyword`: position in the keyword-cascade output (cascade level matters — exact > synonyms).
- `rank_vector`: position by cosine to query embedding.
- `rank_attributes`: position by count of `intent.attribute_*` terms that overlap the product's `attributes` + `technical_specifications` fields. Use the existing helper `getAttributeTerms()` (`src/lib/elia/intent.service.ts:199-230`).

Combine with **Reciprocal Rank Fusion**:

```
score(p) = Σ_i  1 / (k + rank_i(p))     // k = 60 (industry default)
```

Bonus terms (additive, small weights):

- `+w_brand` if `intent` mentioned a brand and the product matches.
- `+w_price` if price is inside `intent.price_min/max`.
- `+w_stock` if `stock_filter` requested in_stock and product is in stock.
- `+w_completeness` proportional to existing `completeness_score` (PIM data quality signal).

Keep top 50. This stage is a few hundred microseconds of pure JS — essentially free.

### 6.3 Stage 3 — LLM rerank (drop to 10, Haiku)

Send Claude compact summaries — NOT full Solr docs:

```ts
type RerankItem = {
  entity_code: string;
  name: string;
  brand?: string;
  price?: number;
  // 8 attributes most relevant to the intent, picked by intersecting
  // intent.attribute_exact/synonyms/related with product attributes:
  key_attributes: Array<{ key: string; value: string }>;
};
```

≈50 tokens per item × 50 items = 2.5K input tokens. Tool: `rerank_products` (Anthropic forced tool_use), output `[{entity_code, score: 0-1, reasons: string[]}]`. Sort, take top 10.

### 6.4 Stage 4 — LLM finalize (top 10, Sonnet for advisory turns)

Today's `analyzeProducts()` shape, **unchanged externally**. It now operates on already-strong candidates so its scores are calibrated against a tighter distribution. The agent receives `AnalyzedProduct[]` and emits one or more `product_group` blocks.

### 6.5 Where the funnel lives

New module: `src/lib/elia/funnel/`

```
funnel/
  index.ts          # runRetrievalFunnel(intent, opts) → AnalyzedProduct[]
  recall.ts         # Stage 1 — keyword + vector union
  rrf.ts            # Stage 2 — RRF + deterministic bonuses
  rerank.ts         # Stage 3 — Claude Haiku rerank tool
  filters.ts        # hard-filter helpers (price, stock, tenant)
```

`runRetrievalFunnel` is what the `search_products` tool handler calls. It returns the post-Stage-3 top-10; the agent then chooses whether to invoke `analyze_products` (Stage 4) or pass the rerank list straight to `finalize_recommendation` (cheaper turn).

### 6.6 Funnel parameters (env-tunable)

| Stage | Param | Default |
|-------|-------|---------|
| 1 | `RECALL_KEYWORD_MAX` | 200 |
| 1 | `RECALL_VECTOR_MAX` | 200 |
| 2 | `RRF_K` | 60 |
| 2 | `RRF_TOP_N` | 50 |
| 3 | `RERANK_TOP_K` | 10 |
| 3 | `RERANK_MODEL` | claude-haiku-4-5 |
| 3 | `RERANK_TIMEOUT_MS` | 4000 |

### 6.7 Observability

Each funnel run logs `{recall_count_kw, recall_count_vec, recall_count_total, rrf_top_score, rerank_top_score, rerank_score_floor, total_ms_per_stage}` for debugging "why didn't I see X?" questions and tuning the bonuses.

---

## 7. Backend

### 7.1 New endpoint: `POST /api/elia/chat` (SSE)

File: `src/app/api/elia/chat/route.ts`.

**Request:** `{ conversation_id?, message, language?, session_id, user_id? }`.

**SSE events:** `conversation`, `block` (any `EliaContentBlock`), `usage`, `done`, `error`.

### 7.2 New module: `src/lib/elia/agent/`

```
agent/
  index.ts                    # runAgentTurn(ctx): AsyncIterable<EliaContentBlock>
  tools.ts                    # Anthropic tool schemas
  tool-handlers.ts            # handlers; one per tool
  prompts.ts                  # advisor system prompt IT/EN, with state slots
  conversation.repository.ts  # load/persist conversations + turns (Mongoose)
  state.ts                    # AgentState reducer (upsertShortlist, recordApproach, ...)
  streaming.ts                # SSE writer
  embeddings.ts               # EmbeddingProvider abstraction (Voyage default → OpenAI fallback)
  knowledge.repository.ts     # vector search + hybrid filter
```

### 7.3 Agent loop (skeleton)

```ts
export async function* runAgentTurn(ctx): AsyncIterable<EliaContentBlock> {
  const messages = await buildClaudeMessages(ctx.conversation, ctx.userMessage);
  const tools = buildToolCatalog(ctx.isAuthorized);
  const MAX_ITER = 5;

  for (let i = 0; i < MAX_ITER; i++) {
    const stream = anthropic.messages.stream({
      model: chooseModel(ctx),
      max_tokens: 2048,
      system: getAgentSystemPrompt(ctx.language, ctx.conversation.agent_state),
      messages, tools,
      tool_choice: { type: 'auto' },
      // prompt-cache the system prompt + tool definitions
    });
    for await (const ev of stream) {
      // forward text deltas + reasoning_step on tool_use start
    }
    const final = await stream.finalMessage();
    messages.push({ role: 'assistant', content: final.content });
    if (final.stop_reason === 'end_turn') return;

    const toolUses = final.content.filter(b => b.type === 'tool_use');
    const results = await Promise.all(toolUses.map(tu => dispatchTool(tu, ctx)));
    for (const { tu, uiBlocks, toolResultText, isError } of results) {
      for (const block of uiBlocks) yield block;
      messages.push({ role: 'user', content: [{ type: 'tool_result',
        tool_use_id: tu.id, content: [{type:'text', text: toolResultText}], is_error: isError }] });
    }
  }
}
```

### 7.4 Building Claude message history

`buildClaudeMessages` reads the last 8 turns from `elia_turns` (replaying `tool_use` / `tool_result` faithfully — required by Anthropic's protocol) up to ~20K tokens. Older turns are summarized into the `system` prompt as `agent_state.rolling_summary` and `agent_state.user_facts`. When the user asks "compare the first two", `recall_conversation` retrieves relevant older turns by embedding similarity. Use `cache_control: { type: 'ephemeral' }` on the system+tools block (cache hits on every iteration of the same turn).

### 7.5 `tool_choice` flip

The forced-tool call site at `src/lib/elia/claude.service.ts:244` **stays as-is** — `extractSearchIntent` and `analyzeProducts` continue to force their respective tools internally. Only the new outer agent loop uses `tool_choice: 'auto'`. This separation means we never destabilize the existing endpoints.

### 7.6 Cost-aware model selection

```ts
function chooseModel(ctx) {
  const advisory = /riparare|consigli|come (posso|si)|aiut|problema|guasto|perdita|rotto|sostitu/i
    .test(ctx.userMessage);
  if (advisory) return 'sonnet';
  if (ctx.conversation.agent_state.proposed_approaches.length > 0) return 'sonnet';
  if (ctx.conversation.turn_count >= 4) return 'sonnet';
  return 'haiku';
}
```

### 7.7 Embeddings

`EmbeddingProvider` abstraction:

- **Default:** Voyage AI `voyage-3` (1024 dims, Anthropic-aligned, cheap). Env `VOYAGE_API_KEY`.
- **Fallback:** OpenAI `text-embedding-3-small` (1536 dims). Env `OPENAI_API_KEY`.
- Embedding model id stored on every chunk + turn; mismatched dims rejected at query time (re-embed on schema bump).

User-turn embedding is computed **before** the agent loop starts. Assistant-turn embedding is computed on the **rolling summary**, not the full block stream (cheaper, denser).

### 7.8 System prompt (Italian primary)

```
Sei ELIA, consulente esperto di prodotti idro-termo-sanitari B2B.
NON sei un motore di ricerca. Sei un consulente che PORTA a prodotti dopo aver capito il problema.

PRINCIPI:
1. Se l'utente descrive un PROBLEMA (riparazione, dimensionamento, scelta tra alternative):
   PRIMA chiama retrieve_knowledge per fondare l'analisi su documentazione tecnica.
   POI proponi 2-3 approcci con propose_repair_approaches.
   POI raccogli dati mancanti con ask_clarification.
   INFINE chiama search_products + finalize_recommendation per ogni approccio.
2. Se l'utente cerca un PRODOTTO chiaro ("lavabo bianco"), vai diretto a search_products.
3. Per follow-up ("compara i primi due", "il foro è 5mm"): leggi lo STATO CORRENTE.
   - product_shortlist: prodotti già visti
   - proposed_approaches: approcci già discussi
   - user_facts: fatti già confermati
   - open_clarifications: domande in sospeso
   NON ripetere domande già fatte.
4. Per riparazioni chiedi sempre: diametro, materiale, tipo di guasto, attrezzi disponibili.
5. Italiano colloquiale ma tecnicamente corretto. Cita sempre le fonti tecniche
   (citation block) quando usi retrieve_knowledge.

STATO CORRENTE:
- Approcci proposti: {proposed_approaches}
- Prodotti già visti: {product_shortlist}
- Fatti confermati: {user_facts}
- Riassunto delle conversazioni precedenti: {rolling_summary}

[Anthropic injects tool list]
```

---

## 8. Frontend (vinc-b2b)

The frontend changes live in the `vinc-b2b` repo. Cross-repo paths below are from the monorepo root.

### 8.1 New types: `vinc-b2b/src/framework/basic-rest/elia/chat-types.ts`

Mirror backend `EliaContentBlock` exactly. `ChatMessage` shape:

```ts
interface ChatMessage {
  turn_id: string;
  role: 'user' | 'assistant';
  blocks: EliaContentBlock[];   // appended-to in real time as SSE arrives
  timestamp: Date;
}
```

### 8.2 New hook: `vinc-b2b/src/framework/basic-rest/elia/use-elia-chat.ts`

Replaces both `use-elia-search.ts` and `use-elia-analyze.ts`. Single SSE consumer with `AbortController`, optimistic user turn, `mergeBlock(prev, turnId, payload)` reducer:

- `text` → accumulate into the last text block of that turn
- `reasoning_step` → de-dup by phase; flip status active→completed
- everything else → push as new block
- caches `conversationId` in `localStorage` for cross-tab continuity (per-session, per-locale)

### 8.3 New renderer: `vinc-b2b/src/components/elia/elia-blocks.tsx`

Switch on block type:

- `text` → markdown render
- `reasoning_step` → fold into existing `EliaReasoningSteps` component per-turn (today it's global)
- `product_group` → title + map products through `EliaAnalyzedProductCard` (extracted from `vinc-b2b/src/components/elia/elia-drawer.tsx:95-188` into its own file)
- `clarification` → new chip UI; `onClick` → `send(option.value)`
- `suggestion` → new chip UI; `onClick` → `send(suggestion.prompt)`
- `citation` → small "Fonte: [doc title]" footer link, expandable
- `tool_use` / `tool_result` → behind a "Mostra ragionamento" disclosure for power users; off by default

### 8.4 Edits to `vinc-b2b/src/components/elia/elia-drawer.tsx` (current 832 lines)

| Lines | Action |
|---|---|
| 34-42 | **Delete** old `Message` interface; import `ChatMessage` from chat-types |
| 44-92 | **Delete** `EliaProductCard` (no longer used; agent always returns analyzed groups) |
| 95-188 | **Move** `EliaAnalyzedProductCard` into its own file `elia-analyzed-product-card.tsx` |
| 198-230 | **Replace** the two old hooks with `const { conversationId, messages, send, streaming } = useEliaChat()` |
| 233-256 | `handleOpenProductPopup` stays |
| 261-264 | Delete global `allReasoningSteps` derivation (now per-turn) |
| 270-325 | **Delete** the entire useEffect chain that auto-triggered analyze and assembled messages — server does it |
| 327-347 | `handleSendMessage` becomes a 2-line wrapper around `send(text)`. **Delete** `handleReset` — chat is now sticky |
| 504-790 | **Replace** message rendering with `messages.map(m => <ChatMessageRow message={m} />)` iterating `m.blocks` through the new block renderer |
| 813 | Remove the `handleReset()` call before `handleSendMessage` (the memory-wipe bug) |
| 466-501 | Empty-state quick prompts stay; just call `send(prompt)` |
| 400-422 | Add small "Nuova conversazione" button that creates a fresh `conversationId` and clears `messages` |

---

## 9. Phasing

Each phase is independently shippable; the legacy `/api/elia/{intent,search,analyze}` endpoints stay untouched throughout.

### 9.1 Phase 1 — Skeleton + funnel Stage 1+2 (1 sprint)

Goal: ship multi-turn search behind a feature flag, with a wider candidate pool than today.

- Add `elia_conversations` + `elia_turns` Mongoose models + repository.
- Add `POST /api/elia/chat` SSE endpoint with **only** `search_products` registered.
- Implement funnel Stages 1–2 (keyword recall widened to 200 + RRF). **Skip vector recall and LLM rerank** in this phase — Stage 1 is keyword-only, Stage 3 is a passthrough that takes the top 10 by RRF score. This already widens the pool 10×.
- Add `useEliaChat` hook + minimal block renderer (text + reasoning_step + product_group).
- Feature-flag with `?elia=v2` so existing UI stays the default.
- Acceptance: "lavabo bianco per bagno piccolo" produces analyzed cards in 1 turn; follow-up "solo quelli sotto i 200€" reuses prior intent; debug log shows ≥100 keyword candidates pre-RRF.

### 9.2 Phase 2 — Advisory tools + RAG + funnel Stage 3 (1 sprint)

Goal: ship the tubo-zincato scenario AND vectors-everywhere.

- Extract `product-merge.ts` helper from `src/app/api/elia/analyze/route.ts:85-183`.
- Add the remaining 6 tools: `analyze_products`, `get_product_details`, `retrieve_knowledge`, `propose_repair_approaches`, `ask_clarification`, `finalize_recommendation`.
- Add `elia_knowledge_chunks` model + Atlas vector index (or Qdrant fallback).
- Add `EmbeddingProvider` (Voyage default).
- **Funnel Stage 1 vector retrieval**: add Solr `dense_vector` field on products + reindex script (or Qdrant sidecar). Embedding generated at PIM publish time; backfill script for existing catalog.
- **Funnel Stage 3 rerank**: add `rerank_products` Haiku tool; integrate into `runRetrievalFunnel`.
- Seed knowledge base from existing supplier docs / internal materials (see §11).
- Update system prompt to advisor persona.
- Add `clarification`, `suggestion`, `citation` block renderers.
- Acceptance: tubo-zincato passes scenarios 2 + 3 below; recall scenario "stoppare la perdita" surfaces "sigillante per giunti" (scenario 6).

### 9.3 Phase 3 — Conversation recall + persistence polish (1 sprint)

- Embed user turns + rolling summaries on insert; backfill script.
- Add `recall_conversation` tool, vector index on `elia_turns`.
- Conversation list sidebar (reopen prior chats; SSO-gated for cross-device).
- Per-turn 👍/👎 → `elia_feedback` collection.
- PostHog events: `elia_chat_started`, `elia_tool_called`, `elia_clarification_answered`, `elia_recommendation_clicked`, `elia_citation_clicked`.
- TTL on archived conversations (90 days anonymous; indefinite SSO).
- Drop the `?elia=v2` flag.

### 9.4 Phase 4 — Optional, later

- Semantic product search via Solr `dense_vector` field for queries the keyword cascade misses (already partly delivered in Phase 2; this phase tunes the bonuses based on observed behavior).
- Multi-conversation memory ("ricordi quando abbiamo discusso la caldaia per il capannone?") — vector recall across user's full history.

---

## 10. Critical files

### 10.1 Net-new (this repo: vinc-commerce-suite)

- `src/lib/types/elia-chat.ts`
- `src/lib/db/models/elia-conversation.ts`
- `src/lib/db/models/elia-turn.ts`
- `src/lib/db/models/elia-knowledge-chunk.ts`
- `src/lib/elia/agent/{index,tools,tool-handlers,prompts,state,streaming,embeddings,knowledge.repository,conversation.repository}.ts`
- `src/lib/elia/funnel/{index,recall,rrf,rerank,filters}.ts`
- `src/lib/elia/product-merge.ts` *(extracted from `app/api/elia/analyze/route.ts`)*
- `scripts/embed-products.ts` *(one-shot reindex; emits embeddings into Solr or Qdrant)*
- `scripts/ingest-elia-knowledge.ts` *(corpus ingestion pipeline)*
- `src/app/api/elia/chat/route.ts`

### 10.2 Net-new (vinc-b2b repo)

- `vinc-b2b/src/framework/basic-rest/elia/{chat-types,use-elia-chat}.ts`
- `vinc-b2b/src/components/elia/elia-blocks.tsx`
- `vinc-b2b/src/components/elia/elia-clarification-block.tsx`
- `vinc-b2b/src/components/elia/elia-suggestion-chips.tsx`
- `vinc-b2b/src/components/elia/elia-citation-block.tsx`
- `vinc-b2b/src/components/elia/elia-analyzed-product-card.tsx` *(extracted)*

### 10.3 Modified

- `vinc-b2b/src/components/elia/elia-drawer.tsx` — wholesale rewrite of state + render, per the table in §8.4
- `src/lib/elia/index.ts` — `export * from './agent'`
- `packages/vinc-pim/src/endpoints.ts` (or equivalent) — add `ELIA_CHAT: 'api/elia/chat'`
- `vinc-b2b` env config — add `NEXT_PUBLIC_ELIA_CHAT_ENABLED`

### 10.4 Reused (do not re-implement)

- `extractSearchIntent()` — `src/lib/elia/intent.service.ts:86`
- `cascadeSearch()` — `src/lib/elia/search.service.ts:97`
- `analyzeProducts()` — `src/lib/elia/claude.service.ts:403`
- Per-tenant Mongo connection pool — `src/lib/db/connection.ts`, `connection-pool.ts`
- Thread model factory pattern — `src/lib/db/models/thread.ts:296-327`
- `EliaReasoningSteps` UI — `vinc-b2b/src/components/elia/elia-reasoning-steps.tsx`
- `useModalAction().openModal('PRODUCT_VIEW', ...)` — pattern in `vinc-b2b/src/components/elia/elia-drawer.tsx:233-256`

---

## 11. Knowledge ingestion

The plan assumes a tenant-scoped corpus seeded into `elia_knowledge_chunks` before Phase 2 ships. This section describes how to populate it from the documents the marketing team already has.

### 11.1 Sources, in priority order

1. **Manufacturer / supplier technical PDFs** (Caleffi, Vaillant, Henkel/Loctite, Tecnoline, Rehau, etc.) — installation manuals, datasheets, application guides. Already in marketing-team possession.
2. **Existing PIM data** — for each product, auto-generate a "How to use this product" chunk from `description`, `short_description`, `technical_specifications`, `attributes`. Tag with `metadata.related_entity_codes: [entity_code]` so retrieval surfaces the linked SKU.
3. **Internal knowledge** — sales-rep notes, CS ticket resolutions, training materials, existing FAQ pages.
4. **Hand-written vocabulary mapping** — colloquial → catalog terminology (e.g. "stoppare la perdita" → "sigillante per giunti"). Highest value-per-hour.
5. **AI-generated starter guides, expert-reviewed** — use Claude to draft canonical "How to choose / how to repair" guides from the catalog; domain expert reviews and corrects.
6. **Trade norms / standards** — UNI EN 10240, UNI 9182, UNI EN 12056. Reference summaries only (paywalled full text excluded).

### 11.2 Ingestion pipeline

New script: `scripts/ingest-elia-knowledge.ts`.

```
sources/                              # registry (yaml per source)
  caleffi-fascette.yaml              # {url|path, license, refresh, tags}
  pim-products.yaml                   # {source: 'mongo', collection: 'products'}
  internal-troubleshooting.yaml       # {source: 'sharepoint', folder: '...'}
  launch-seed-guides.yaml             # {source: 'local', path: 'data/seed/'}

pipeline:
  1. Loader     — fetch PDF / HTML / DOCX / Mongo doc / text per source type
  2. Parser     — pdfplumber for PDFs, mammoth for DOCX, Cheerio for HTML
  3. Chunker    — semantic split on headings, ~400 tokens per chunk, 60 overlap
  4. Enricher   — Claude Haiku tags each chunk:
                  { category, approach_tag, product_class, language,
                    related_entity_codes? (LLM matches to PIM SKUs) }
  5. Filter     — drop chunks <100 tokens, drop boilerplate (regex)
  6. Embedder   — voyage-3, store with model id
  7. Persister  — upsert into elia_knowledge_chunks (key: hash(text))
  8. Reindexer  — Mongo Atlas vector index rebuild (or Qdrant collection sync)
```

CLI:

```bash
pnpm tsx scripts/ingest-elia-knowledge.ts --source pim-products --tenant dfl_it
pnpm tsx scripts/ingest-elia-knowledge.ts --source caleffi-fascette --tenant dfl_it
pnpm tsx scripts/ingest-elia-knowledge.ts --all --tenant dfl_it --dry-run
```

### 11.3 Launch corpus target — ~80 chunks for Phase 2 acceptance

| Bucket | # chunks | Source |
|---|---|---|
| Fascette riparatubi (sizing, pressure, install) | ~10 | Caleffi/Tecnoline PDFs + PIM datasheets |
| Sigillanti epossidici per metallo | ~10 | Henkel/Loctite/Pattex PDFs |
| Sostituzione tratto + saldobrasatura zincato | ~6 | Trade norms + internal guide |
| Diametri e standard tubazioni zincate | ~5 | UNI summaries + internal reference |
| Pressioni di esercizio impianti idrici | ~5 | Internal guide + manufacturer notes |
| PIM-derived "how to use" chunks for fascetta SKUs | ~15 | Auto-generated from PIM `attributes` |
| PIM-derived for sigillante SKUs | ~10 | Auto-generated from PIM |
| Internal troubleshooting cases (anonymized) | ~15 | CRM/ticket export |
| Italian colloquial vocabulary mapping | ~5 | Hand-written |

### 11.4 Close-the-loop content ops

Static corpora rot. Build feedback in from day one:

1. Log every `retrieve_knowledge` call with query + top-K scores (already covered by §6.7).
2. Flag low-score retrievals (< 0.65) — daily report becomes the input list for the next ingestion round.
3. Flag thumbs-down feedback (Phase 3) — drill from 👎 turns back to which chunks were retrieved; if none were relevant, that's a content gap to fill.

Target: launch with 80 chunks, hit 300 within a quarter — driven by actual usage, not speculative content authoring.

---

## 12. Verification

### 12.1 Functional scenarios

1. **Direct search** — "lavabo bianco per un bagno piccolo" → assistant turn contains: `search_products` tool_use → `analyze_products` tool_use → text + 1 `product_group` (≥3 entries). ≤2 iterations.
2. **Advisory** — "Devo riparare un tubo zincato da un foro che causa una perdita" → assistant turn contains: `retrieve_knowledge` tool_use, `propose_repair_approaches` (≥2 options), `ask_clarification` (diameter/hole). NO `search_products` this turn. ≥1 `citation` block.
3. **Follow-up** — "il foro è di 5mm e non ho la saldatrice" → does NOT re-ask diameter; emits exactly 2 `product_group` blocks (fascetta + epossidica), drops `sostituzione`. Server log asserts `agent_state.user_facts == { hole_size:'5mm', has_welder:false, ... }`.
4. **Comparison** — "compara i primi due" → uses `agent_state.product_shortlist`, calls `get_product_details` for the top-2; NO `search_products`.
5. **Cross-turn recall** — after 12+ turns, ask about a fact mentioned in turn 2; agent calls `recall_conversation` and surfaces the right citation.
6. **Wide-recall rescue** — "qualcosa per stoppare la perdita di un giunto" → keyword cascade alone returns 0–2 hits because the catalog uses "sigillante per giunti", not "stoppare". Funnel Stage 1 vector retrieval adds the right products; Stage 3 reranks them to the top. Server log asserts `recall_count_vec >= 5` and the final `product_group` contains at least one product whose `entity_code` was NOT in the keyword-cascade list.
7. **Funnel telemetry** — for each of scenarios 1, 2, 6: assert `recall_count_total >= 50`, `rrf_top_score > rerank_score_floor`, and that the post-rerank top product matches the manual-test expected `entity_code` set defined in the test fixture.

### 12.2 Test infrastructure

- Backend: `src/lib/elia/agent/__tests__/agent-flows.test.ts`. Mock Anthropic with a stubbed `messages.stream()` that emits scripted `content_block_*` events; mock embedding provider; in-memory Mongo via `mongodb-memory-server`.
- Frontend: Playwright at `vinc-b2b/tests/elia-chat.spec.ts`, the seven scenarios end-to-end against a staging tenant.
- Smoke: `curl` the SSE endpoint with each scenario and assert the expected event sequence (block types and order).

### 12.3 Manual UI sanity

1. `cd vinc-b2b && pnpm dev`, open the tenant on `?elia=v2`, run scenarios 1–6 by hand.
2. Open DevTools → Network → confirm SSE events arrive incrementally (text deltas, reasoning steps, then product groups).
3. Refresh the page and confirm the conversation reloads from `localStorage` `conversationId`.

---

## 13. Open questions / risks

1. **Mongo flavor** — confirm Atlas (with `$vectorSearch`) vs self-hosted. If self-hosted without vector support, switch knowledge + recall to Qdrant. *Verification needed before Phase 2 starts.*
2. **Knowledge corpus** — content owner (likely product marketing + a domain expert) must hand over existing supplier docs and confirm licensing for top suppliers before Phase 2. Without docs, RAG returns nothing and the advisor falls back to ungrounded reasoning (still better than today, but not the design).
3. **Voyage vs OpenAI** — confirm which embedding provider has an existing key in the org. Voyage is the design default; OpenAI is the fallback.
4. **Tool-loop safety** — `MAX_ITER=5` may be too tight on complex advisory turns. Plan B: per-turn token budget instead of iteration count.
5. **Cost ceiling** — set a per-conversation $ cap (e.g. $0.50). Exceeding triggers a polite "let me hand you to a sales rep" finalize tool.
6. **Tenant isolation in vector indexes** — Atlas `$vectorSearch` filter on `tenant_id` must be in the index definition, not as a post-filter, otherwise tenants leak. Plan B (Qdrant): one collection per tenant.
7. **Migration of existing UI consumers** — verify nothing else imports `useEliaSearch` / `useEliaAnalyze` before deleting them in Phase 3.
8. **Solr 9.x dense_vector availability** — confirm production Solr version. If 8.x, the funnel ships with Qdrant sidecar in Phase 2 instead. Decision needed before Phase 2 starts.
9. **Product re-embedding cost** — first run over the full catalog: `catalog_size × ~$0.00002/embedding` (voyage-3 lite). For a 100K-SKU tenant ≈ $2 one-shot, then incremental on publish. Trivial; flagging only for budget paperwork.
10. **Funnel quality vs latency** — Stage 1 widening from 20 → 200 candidates and adding vector recall costs ~150–250 ms. Stage 3 rerank adds ~600–900 ms (Haiku). Total turn latency rises from ~2.5 s today to ~3.5 s. Mitigate with prompt caching on system prompt + tool defs (cache hit on every iteration). If unacceptable, add an escape hatch: skip rerank when Stage 2 top-10 RRF score gap is large (already-confident signal), saving ~700 ms.

---

## 14. Marketing team deliverables (summary)

The full kickoff brief lives in the appendix below. Pre-Phase-2 marketing work, ~2 weeks part-time, assuming source documents are already in the team's possession:

| ID | Deliverable | Owner | Effort |
|----|-------------|-------|--------|
| 1 | Handover existing documents to a shared folder | Product Marketing | 0.5 day |
| 2 | Supplier license confirmation (top 10) | Product Marketing + Legal | 1–2 days |
| 3 | Approach taxonomy (problem class → approach tags → catalog categories) | PM + domain expert | 0.5 day |
| 4 | ELIA voice spec (1-page brief) | PM + Brand | 0.5 day |
| 5 | 5 vocabulary-mapping chunks (colloquial → catalog) | Domain expert | 1 afternoon |
| 6 | 50 acceptance scenarios (real customer questions + expected answers) | CS Lead + Sales Rep | 1–2 days |
| 7 | Review of auto-generated PIM chunks (10% sample) | PM + domain expert | 0.5 day |

What blocks engineering if a deliverable slips:

| Missing | Impact |
|---------|--------|
| 1 / 2 | Phase 2 ingestion pipeline has nothing to ingest → `retrieve_knowledge` returns empty. **Hard blocker.** |
| 3 | `propose_repair_approaches` outputs free-text tags that don't link to catalog categories. Loss of precision. |
| 4 | System prompt lacks tone guidance; AI sounds generic / off-brand. Soft blocker. |
| 5 | Wide-recall rescue (scenario 6) degrades; vocabulary-mapping chunks are the highest-leverage retrieval signal. |
| 6 | No regression fixture; quality drift undetected. Phase 3 polish flies blind. |

---

## 15. Appendix — Marketing kickoff email (Italian)

> Pronto da inviare. Sostituire `[il tuo nome]` e adattare i giorni nella call-to-action.

---

**Oggetto:** ELIA Fase 2 — i documenti ce li avete già: serve solo l'handover (~2 settimane part-time)

Ciao team,

abbiamo confermato che la documentazione tecnica che serve per ELIA Fase 2 (PDF fornitori, materiali interni, FAQ, storico CRM) è già nei vostri archivi. Ottima notizia: il vostro impegno si dimezza e possiamo partire la prossima settimana.

**Cosa stiamo costruendo.** ELIA Fase 2 = trasformare il chatbot da motore di ricerca a consulente. Quando un cliente chiede *"come riparo un tubo zincato bucato?"*, oggi risponde con una lista di tubi. Vogliamo che proponga 2–3 approcci tecnici (fascetta, epossidico, sostituzione), chieda i dati che le servono, e consigli i prodotti per ogni approccio — fondando la risposta sulla documentazione che già avete.

### Cosa serve da voi (~2 settimane, in parallelo con engineering)

**Settimana 1 — Consegna e setup**

1. **Handover documenti esistenti** — caricate in una cartella condivisa (Drive/SharePoint/S3, decidiamo insieme) tutto il materiale tecnico già in vostro possesso: PDF fornitori, manuali, schede applicative, FAQ interne, eventuale esportazione di ticket CRM rilevanti. Engineering ingestisce in autonomia.
   *Owner: Product Marketing — 0.5 giornata.*

2. **Conferma licenze** — per i 10 fornitori principali, OK scritto (anche solo email) all'uso dei loro documenti dentro l'advisor interno. Quelli incerti vanno in una coda separata e si ingestiscono dopo.
   *Owner: Product Marketing + Legal — 1–2 giornate.*

3. **Tassonomia degli approcci** — lista canonica per classe di problema: es. riparazioni idrauliche → `[fascetta, epossidico, sostituzione, saldobrasatura]`. Vi mando una bozza, voi correggete e mappate sulle categorie del catalogo.
   *Owner: PM + esperto di dominio — 0.5 giornata.*

4. **Voice spec di ELIA** — 1 pagina: tono, pattern approvati, termini banditi, copy di compliance/GDPR. Va dritto nel system prompt.
   *Owner: PM + Brand — 0.5 giornata.*

5. **5 chunk di "mappatura vocabolario"** — l'esperto di dominio scrive 5 corrispondenze colloquiale → catalogo (es. *"stoppare la perdita"* → *"sigillante per giunti"*). Un pomeriggio. È il contenuto a più alta leva di tutto il progetto.
   *Owner: esperto di dominio (idraulico/HVAC senior) — 1 pomeriggio.*

**Settimana 2 — Validazione**

6. **50 scenari di accettazione** — 50 domande reali dei clienti dai ticket CS, con annotata la "risposta corretta attesa". Diventa la suite di regressione per non far peggiorare la qualità nel tempo.
   *Owner: CS Lead + Sales Rep — 1–2 giornate.*

7. **Review chunk autogenerati dal PIM** — engineering autogenera ~25 chunk dal PIM ("come usare il prodotto X"); a voi serve solo rivedere a campione il 10% per qualità.
   *Owner: PM + esperto di dominio — 0.5 giornata.*

### Effort totale

~1.5 settimane part-time spalmate tra i ruoli sopra. **Niente scrittura ex-novo:** la pipeline di engineering ingestisce automaticamente i documenti che esistono già.

### Cosa NON serve fare adesso

Tutto quello che non è in questa lista (riempire ogni edge case, scrivere guide nuove, coprire ogni categoria) lo gestiamo post-lancio con il loop di feedback automatico — log dei retrieval con score basso, 👍/👎 sui turni, gap board settimanale. Si parte con l'80% del valore, il resto cresce guidato dai dati reali.

### Prossimo passo

Kickoff di 30 minuti questa settimana per:

- decidere dove caricate i documenti (cartella condivisa)
- confermare gli owner sulle 7 righe qui sopra
- allineare il calendario con la Fase 1 engineering

Disponibilità per martedì o mercoledì pomeriggio?

Grazie,
[il tuo nome]
