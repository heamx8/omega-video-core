# Omega Video Core

Experimental, offline JavaScript building blocks for user-controlled video editing.

**This first public release is a developer toolkit, not an installable video editor or a Premiere Pro plugin.** It contains six extracted pure-data modules. It has no AI provider integration, automatic video understanding, media decoding or editor connection. Those are future integration work, not shipped capabilities.

## Why this exists

We believe the future of video creation should give creators more control: inspectable edit decisions, portable data, and the freedom to modify and share the tools they rely on. We want AI to reduce repetitive work while keeping people in charge of their creative choices.

Our long-term ambition is to reduce dependence on closed editing workflows and make more capable open tools available. We support transparent pricing, clear cancellation terms and genuine user choice. This is a direction for development, not a claim that this early toolkit replaces existing editors.

## Included

| Module | Purpose |
| --- | --- |
| cuts | Plan and verify splits against plain timeline snapshots |
| range-edit | Model single-range deletion with or without closing the gap |
| range-batch | Plan multiple deletions and predicted downstream positions |
| silence-options | Validate retained-pause settings; does not detect silence |
| transcript | Validate timed-word data and map selections to a normal-speed clip |
| game-framing | Calculate fit/fill geometry for a supplied screen-content rectangle |

## Run locally

Requires Node.js 20 or later. No dependencies, paid account, API key or media file is required.

~~~sh
npm test
npm run demo
~~~

The demo uses synthetic clip metadata and prints a plan. It does not open an editor or change files.

## Scope and limitations

- Pure-data tests verify planning, not native editor execution or audiovisual quality.
- Adapters must obtain current snapshots, check permissions and track state, execute changes, and verify results. No adapter is included here.
- Range operations reject unsupported transitions, markers, retimed clips and other unsafe inputs; consult the source and tests rather than assuming universal timeline support.
- Batch planning can skip ranges whose tracks cannot follow the same removal span. Callers must inspect the returned skipped list.
- Framing currently expects Windows-style absolute source identifiers. No recording, crop preset or client calibration is bundled.
- There is no telemetry, network call or automatic filesystem access in the exported core.
- This is an early public release with no claimed adoption, downloads or production-readiness guarantee.

## Privacy and licensing

This repository contains generic source and synthetic tests only. Client media, presets, creative direction, project files, transcripts, credentials, internal logs and third-party licensed assets are excluded. The broader application is not distributed as a binary here.

Released under GPL-3.0-only; see LICENSE. This release uses no vendored runtime dependencies. Brand names describing compatibility do not imply affiliation or endorsement.

## Contributing

See CONTRIBUTING.md and ROADMAP.md. Please submit minimal synthetic reproductions, not private recordings or project data.
