# AgonAI

Multi-agent debate simulation system modeling historical political figures.
Built with Next.js 16, TypeScript, and React. Uses xAI (Grok) API for LLM.

## Stack
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **LLM**: OPENAI (GPT)
- **Deploy**: Vercel

## Structure
- `app/` — Next.js pages and API routes
- `lib/agents/` — Agent classes (base, historical, baseline, judge)
- `lib/debates/` — Debate simulator and experiment runner
- `lib/scoring/` — Policy scoring (OCEAN, benefit-cost, empathy)
- `lib/utils/` — xAI client, memory clients, conversation state

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
