# AgonAI - Political Agent Debate Lab

A system for simulating political debates and negotiations between AI agents modeled after historical figures with opposing ideologies. Built with Next.js and TypeScript.

## Research Question
Can political AI agents of historical figures who opposed each other reach a consensus in a simulated setting?

## Example Scenarios
- **Hitler vs Gandhi vs Jinnah**: Exploring ideological conflicts and potential common ground
- **US vs Japan**: Could the atomic bomb have been prevented? How?
- **Trump vs Mao**: Trade and tariff negotiations
- **Winston Churchill vs Karl Marx vs Niccolò Machiavelli**: Different political ideologies

## Key Features
- Historical figure personality modeling (OCEAN traits, ideology compatibility)
- Multi-agent debate simulation with consensus detection
- Policy scoring across political, economic, and social dimensions
- Empathy-weighted negotiation and fatigue modeling
- 8 pre-configured experiments (rational vs empathetic, historical conflicts, etc.)
- xAI (Grok) API integration for LLM-powered dialogue
- Interactive web UI with chat-style debate visualization

## Project Structure
```
├── app/              # Next.js app (pages + API routes)
│   ├── page.tsx      # Main UI (React)
│   ├── api/
│   │   ├── chat/     # POST /api/chat — xAI chat wrapper
│   │   ├── simulate/ # POST /api/simulate — debate runner
│   │   └── experiment/ # POST /api/experiment — experiment runner
│   └── globals.css
├── lib/              # Core TypeScript library
│   ├── agents/       # Historical figure AI agents
│   ├── debates/      # Debate simulator + experiment runner
│   ├── scoring/      # Policy scoring system
│   └── utils/        # xAI client, memory, conversation state
└── .env.example      # Environment variables
```

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your XAI_API_KEY

# Run development server
npm run dev
```

Then open `http://localhost:3000`.

## Environment Variables
- `XAI_API_KEY` (required) — xAI API key for Grok LLM
- `XAI_MODEL` (default `grok-3-mini`) — model to use
- `XAI_BASE_URL` (default `https://api.x.ai/v1`)
- `CHAT_CACHE_TTL_S` (default `120`) — chat response cache TTL
- `CHAT_CACHE_MAX_ITEMS` (default `256`) — max cached responses
- `SUPERMEMORY_API_KEY`, `SUPERMEMORY_BASE_URL` — optional memory service
- `EXA_API_KEY`, `EXA_BASE_URL` — optional context search

## API Endpoints

### POST /api/simulate
Run a debate simulation.
```json
{
  "agents": ["hitler", "gandhi", "jinnah"],
  "topic": "territorial disputes",
  "rounds": 12
}
```

### POST /api/chat
Single-message chat with xAI.
```json
{
  "messages": [{"role": "user", "content": "Hello"}],
  "temperature": 0.2,
  "max_tokens": 512
}
```

### POST /api/experiment
Run a pre-configured experiment (1-8).
```json
{
  "experimentId": 3,
  "topic": "war",
  "maxRounds": 15,
  "historicalAgents": ["hitler", "gandhi"]
}
```

## Deploy to Vercel
```bash
vercel
```

## License
MIT
