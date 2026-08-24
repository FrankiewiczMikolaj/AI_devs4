# S01E04 — sendit

An autonomous agent fills in a shipment declaration based on documentation it has
to explore on its own, and keeps working until the hub validator accepts the file.

The point of the lesson is the agent loop, not the answer: the agent gets file
tools over a sandboxed workspace, a vision tool for material that is not text, and
a submit tool that returns the validator's verdict as feedback.

## Running

```bash
npm run s01e04:install      # bun + lesson deps + files-mcp deps
npm run lessons:s01e04:op   # run with secrets injected from 1Password
npm run lessons:s01e04      # run with secrets already in the environment
```

Development and checks:

```bash
npm run lessons:s01e04:dev        # watch mode
npm run lessons:s01e04:test      # unit tests
npm run lessons:s01e04:typecheck # tsc --noEmit
```

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `HUB_API_KEY` | yes | authenticates submissions to the hub validator |
| `OPENAI_API_KEY` or `OPENROUTER_API_KEY` | yes | model access; see root `config.js` |
| `AI_PROVIDER` | no | forces `openai` or `openrouter` when both keys exist |
| `S01E04_REFRESH_DOCS` | no | set to `1` to re-download the documentation |

Models are pinned in `src/config.ts` (`AI_MODEL`, `VISION_MODEL`) rather than taken
from the environment, so a run is reproducible from the source alone.

## How a run proceeds

`main.ts` downloads the documentation (following `[include]` references
recursively), clears the previous result file, spawns the `files-mcp` server over
stdio and hands its tools plus the native ones to the agent loop.

`agent.ts` then alternates between model calls and tool calls until the validator
accepts the declaration or `MAX_AGENT_ROUNDS` runs out. Calls within a round run
concurrently, except `submit_declaration`, which always runs last so the validator
never reads the result file while a write is still in flight.

## Layout

| Path | Responsibility |
|---|---|
| `src/main.ts` | wiring and run report |
| `src/agent.ts` | the round loop and tool dispatch |
| `src/api.ts` | Responses API access: timeout, retries, token accounting |
| `src/config.ts` | paths, models, limits |
| `src/hub-data.ts` | documentation download with atomic writes |
| `src/declaration.ts` | result file lifecycle |
| `src/mcp/client.ts` | stdio MCP client driven by `mcp.json` |
| `src/native/` | tools implemented in-process: vision and submission |
| `src/prompts/` | agent instructions and the task message |

`workspace/` is generated at runtime and git-ignored: `workspace/spk/` holds the
downloaded documentation, `workspace/output/declaration.txt` the agent's result.

## Prompt design

`src/prompts/instructions.ts` deliberately states properties of the environment
rather than a sequence of steps: what the tools do and cost, how documentation
behaves as a source, what a finished result looks like, and what a rejection
means. Task-specific facts belong in `src/prompts/task.ts` instead, which keeps
the instruction set reusable.
