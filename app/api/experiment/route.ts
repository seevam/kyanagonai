import { NextRequest, NextResponse } from "next/server";
import { createAgent } from "@/lib/agents/agent-registry";
import { OpenAIClient } from "@/lib/utils/openai-client";
import {
  getExperimentConfigs,
  runExperiment,
  experimentResultAsDict,
  EXPERIMENT_TOPICS,
} from "@/lib/debates/experiment-runner";

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
    {
      experiments: [
        { id: 1, name: "Rational vs Rational", needsHistorical: false },
        { id: 2, name: "Empathetic vs Empathetic", needsHistorical: false },
        { id: 3, name: "Rational vs Empathetic", needsHistorical: false },
        { id: 4, name: "Low Empathy vs High Empathy", needsHistorical: false },
        { id: 5, name: "Historical Conflict", needsHistorical: true },
        { id: 6, name: "Historical + Empathy Injection", needsHistorical: true },
        { id: 7, name: "Historical + Judge", needsHistorical: true },
        { id: 8, name: "Full Pipeline", needsHistorical: true },
      ],
      topics: EXPERIMENT_TOPICS,
      agents: ["hitler", "gandhi", "jinnah", "rational", "empathetic"],
    },
    { headers: corsHeaders() },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const experimentId = parseInt(String(body.experimentId ?? "1"), 10);
    const topic = String(body.topic ?? "war");
    const maxRounds = parseInt(String(body.maxRounds ?? "15"), 10);

    const llmClient = new OpenAIClient();

    let historicalAgents;
    const histNames = (body.historicalAgents ?? []) as string[];
    if (histNames.length >= 2) {
      historicalAgents = histNames.slice(0, 2).map((n) => createAgent(n, { llmClient }));
    }

    const configs = getExperimentConfigs({ topic, historicalAgents, maxRounds, llmClient });

    const idx = experimentId - 1;
    if (idx < 0 || idx >= configs.length) {
      return NextResponse.json(
        { error: `Experiment ${experimentId} not available` },
        { status: 400, headers: corsHeaders() },
      );
    }

    const result = await runExperiment(configs[idx]);
    const raw = experimentResultAsDict(result);

    // Map keys to match frontend expectations
    const transcript = result.debateResult.rounds.map((rd) => ({
      round_number: rd.roundNumber,
      speaker: rd.speaker,
      response: rd.response,
    }));

    return NextResponse.json(
      {
        ...raw,
        key_agreements: raw.agreements,
        key_disagreements: raw.disagreements,
        policy_scores: raw.scorecards,
        transcript,
      },
      { headers: corsHeaders() },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error", detail: String(err) },
      { status: 500, headers: corsHeaders() },
    );
  }
}
