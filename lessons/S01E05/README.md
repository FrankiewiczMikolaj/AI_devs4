# S01E05 — railway

An autonomous agent opens a closed railway route by talking to a self-documenting
hub API. The lesson focus is production limits (503 overload, 429 + `retry_after`)
and observability — not a hardcoded workflow.

## Running

```bash
npm run s01e05:install      # bun + lesson deps
npm run lessons:s01e05:op   # run with secrets injected from 1Password
npm run lessons:s01e05      # run with secrets already in the environment
```

Development and checks:

```bash
npm run lessons:s01e05:dev        # watch mode
npm run lessons:s01e05:test       # unit tests
npm run lessons:s01e05:typecheck  # tsc --noEmit
```

Optional JSONL run log:

```bash
S01E05_RUN_LOG=1 npm run lessons:s01e05:op
```

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `HUB_API_KEY` | yes | authenticates calls to hub `/verify` |
| `OPENAI_API_KEY` or `OPENROUTER_API_KEY` | yes | model access; see root `config.js` |
| `AI_PROVIDER` | no | forces `openai` or `openrouter` when both keys exist |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | no | tracing (one run = one Langfuse session) |
| `LANGFUSE_BASE_URL` | no | Langfuse host (default cloud) |
| `S01E05_RUN_LOG` | no | set to `1` for JSONL under `workspace/runs/` |

Models and USD prices are pinned in `src/config.ts`, so a run is reproducible from
the source alone.

## How a run proceeds

`main.ts` starts observability (console always; Langfuse and JSONL when configured),
hands a `sessionId` and event bus to the agent, then prints a cost/usage summary and
persists a new flag to `workspace/output/flags.json` when the hub returns `{FLG:...}`.

`agent.ts` alternates model calls and `railway_api` until a flag appears or
`MAX_AGENT_ROUNDS` runs out. Hub HTTP 503 and 429 are absorbed inside the railway
client (backoff / `retry_after` wait), so the model only sees the final response.

## Layout

| Path | Responsibility |
|---|---|
| `src/main.ts` | wiring, summary, flag persistence |
| `src/agent.ts` | round loop, tool dispatch, events |
| `src/api.ts` | Responses API: timeout, retries, token accounting |
| `src/config.ts` | models, prices, limits, paths |
| `src/native/railway.ts` | hub client: 503 backoff, 429 + `retry_after` |
| `src/native/tools.ts` | single `railway_api` tool |
| `src/prompts/` | agent instructions and the task message |
| `src/events/` | mini event bus |
| `src/observability/` | console / Langfuse / JSONL subscribers |
| `src/summary.ts` | end-of-run rounds, tokens, $, hub waits |
| `src/flag.ts` | append unique flags to `workspace/output/flags.json` |

`workspace/` is generated at runtime and git-ignored: `workspace/runs/` holds optional
JSONL traces, `workspace/output/flags.json` captured flags.

## Prompt design

`src/prompts/instructions.ts` states properties of the environment rather than a
sequence of API actions: what the tool does, that documentation comes from the API,
that 503/429 are handled by the runtime, and what success looks like. Task-specific
facts (route `X-01`, start from `help`) live in `src/prompts/task.ts`.

## Design notes

- One tool (`railway_api`); the agent discovers actions via `help`.
- Rate-limit signal is in the JSON body (`retry_after`), not HTTP headers.
- Shared root `hub.js` is left alone — this lesson uses its own client.
