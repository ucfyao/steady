# Steady

A three-minute daily focus check built on the Sustained Attention to Response Task (SART) with thought probes. Take-home assignment for Walk the Dragon.

> **Status:** work in progress. The scoring and progress core (Specs 001–002) is done and tested; the API and the web app come next.

## Repository layout

```
packages/core    @steady/core: pure TypeScript session plan, validation, scoring and progress
specs/           one folder per feature (GitHub Spec Kit layout: spec.md, plan.md, tasks.md)
docs/            design note and AI-assisted development log
```

## Design note

See [docs/design-note.md](docs/design-note.md): which task I chose and why, how it plays, how it is scored, how progress is shown, and the trade-offs.

## AI tools

I use Claude Code for implementation, reviewing its output against the spec and the tests. Where the AI was wrong, and how each problem was caught: [docs/ai-log.md](docs/ai-log.md).
