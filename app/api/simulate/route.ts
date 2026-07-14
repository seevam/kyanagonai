import { NextRequest, NextResponse } from "next/server";
import { createAgent } from "@/lib/agents/agent-registry";
import { OpenAIClient } from "@/lib/utils/openai-client";
import { SuperMemoryClient, ExaContextClient } from "@/lib/utils/memory-clients";
import { InMemoryConversationStore, loadState } from "@/lib/utils/conversation-state";
import { DebateSimulator } from "@/lib/debates/debate-simulator";

const conversationStore = new InMemoryConversationStore();

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  return NextResponse.json(
    { status: "ok", service: "simulate", agents: ["hitler", "gandhi", "jinnah", "rational", "empathetic"] },
    { headers: corsHeaders() },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const agentNames = (body.agents ?? []) as string[];
    const topic = (body.topic ?? "") as string;
    const rounds = parseInt(String(body.rounds ?? "12"), 10) || 12;
    const useOpenAI = !!(body.useGemini ?? body.useXai ?? body.useOpenAI ?? true);
    const model = (body.model as string) ?? undefined;
    const sessionId = (body.sessionId as string) ?? undefined;
    const stream = !!(body.stream ?? false);

    if (agentNames.length < 2) {
      return NextResponse.json({ error: "Select at least two agents" }, { status: 400, headers: corsHeaders() });
    }
    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400, headers: corsHeaders() });
    }

    const llmClient = useOpenAI ? new OpenAIClient({ model }) : null;
    const memoryClient = new SuperMemoryClient();
    const exaClient = new ExaContextClient();

    const conversationState = loadState(sessionId, conversationStore);
    if (!conversationState.turns.length) {
      conversationState.appendTurn("user", `Run a debate on: ${topic}`);
    }

    let agents;
    try {
      agents = agentNames.map((name) =>
        createAgent(name, { llmClient, memoryClient }),
      );
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 400, headers: corsHeaders() });
    }

    const simulator = new DebateSimulator({ maxRounds: rounds, consensusThreshold: 0.7 });
    const contextBriefing = await exaClient.fetchContext(topic);

    const debateContext = {
      historical_period: "1940s",
      context: "High-stakes political negotiation",
      stakes: "Critical - involves national interests and survival",
      use_llm: !!llmClient,
      context_briefing: contextBriefing,
      conversation_state: conversationState,
      policy_scoring: true,
    };

    if (!stream) {
      const result = await simulator.debate(agents, topic, debateContext);
      scoreAllRounds(result, agents, topic, rounds);
      return NextResponse.json(buildPayload(result, agents, agentNames, topic, conversationState), { headers: corsHeaders() });
    }

    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    (async () => {
      try {
        const result = await simulator.debate(agents, topic, debateContext, async (rd) => {
          const chunk = {
            type: "round",
            round: rd.roundNumber,
            speaker: rd.speaker,
            content: rd.response.trim(),
          };
          await writer.write(encoder.encode(JSON.stringify(chunk) + "\n"));
        }, async (speaker, roundNumber) => {
          await writer.write(encoder.encode(JSON.stringify({ type: "thinking", speaker, round: roundNumber }) + "\n"));
        });

        scoreAllRounds(result, agents, topic, rounds);
        const payload = buildPayload(result, agents, agentNames, topic, conversationState);
        await writer.write(encoder.encode(JSON.stringify({ type: "complete", ...payload }) + "\n"));
      } catch (err) {
        const errChunk = { type: "error", error: String(err) };
        await writer.write(encoder.encode(JSON.stringify(errChunk) + "\n"));
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        ...corsHeaders(),
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", detail: String(err) },
      { status: 500, headers: corsHeaders() },
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoreAllRounds(result: any, agents: any[], topic: string, maxRounds: number) {
  for (let roundNum = 0; roundNum < result.rounds.length; roundNum++) {
    const rd = result.rounds[roundNum];
    const speaker = agents.find((a: { name: string }) => a.name === rd.speaker);
    if (speaker) {
      let opponentObj = 0;
      for (const other of agents) {
        if (other.name !== speaker.name && other.scorecard.objectiveValues.length) {
          opponentObj = other.scorecard.objectiveValues[other.scorecard.objectiveValues.length - 1];
        }
      }
      speaker.scoreRound({
        topic,
        roundNumber: roundNum + 1,
        maxRounds: maxRounds,
        opponentObjective: opponentObj,
      });
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPayload(result: any, agents: any[], agentNames: string[], topic: string, conversationState: any) {
  return {
    agents: agentNames,
    topic,
    status: result.status,
    consensusScore: Math.round(result.consensusScore * 10000) / 10000,
    rounds: result.rounds.length,
    durationMinutes: Math.round(result.durationMinutes * 100) / 100,
    agreements: result.keyAgreements,
    disagreements: result.keyDisagreements,
    sessionId: conversationState.sessionId,
    chatMessages: result.rounds.map((rd: { roundNumber: number; speaker: string; response: string }) => ({
      round: rd.roundNumber,
      speaker: rd.speaker,
      content: rd.response.trim(),
    })),
    policyScores: Object.fromEntries(agents.map((a) => [a.name, a.scorecard.asDict()])),
    empathyRatios: Object.fromEntries(
      agents.map((a) => [a.name, Math.round(a.empathyRatio * 1000) / 1000]),
    ),
    conversationEmpathyReservoir: Math.round(conversationState.metrics.empathyReservoir * 1000) / 1000,
    oceanTraits: Object.fromEntries(agents.map((a) => [a.name, a.ocean.asDict()])),
    majorityVote: result.majorityVote,
    finalResolution: result.finalResolution,
    judgeVerdict: result.judgeVerdict ?? null,
  };
}
