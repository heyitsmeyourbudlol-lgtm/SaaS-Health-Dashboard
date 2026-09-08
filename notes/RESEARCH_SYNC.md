# Research sync — team handoff

_Updated 2026-09-08 04:12Z_ · both lanes · dispatched=False

> **For:** peer orchestrator, cursor-agent, automation_improve, full 8-worker team.
> Efficiency + output research run **synchronously** each cycle.

## Efficiency lane (speed × yield)

- **[high]** Hub queue_known content-fp (L70) — touch-remiss known **2.09→0.036ms**; next: optional `_queue_md_index` sync/orphan share or SCAN_BOTTLENECKS_TTL hub

## Output lane (monster factory)

- **[medium]** Factory progress below self-sufficient target — ./scripts/peer progress

## Executable enqueue (improve + peer)

- (none this cycle)

## Team instructions

1. **Orchestrator** — read this file + lane digests before Phase 1 Plan.
2. **Factory Engineer** — implement efficiency findings (hot path, queue, pre-dispatch).
3. **OSS Integration Architect** — implement output findings (external proof, PR).
4. **Queue Steward** — ensure enqueued `[efficiency-research]` / `[output-research]` items stay executable.
5. **Improve loop** — `./scripts/peer improve --write --research` consumes sync on next tick.

## Linked digests

- Efficiency: `notes/EFFICIENCY_RESEARCH.md`
- Output: `notes/OUTPUT_RESEARCH.md`
- Industry trends: `notes/AUTOMATION_TRENDS.md`

