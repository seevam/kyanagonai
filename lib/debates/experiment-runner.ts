/**
 * Experiment runner for Goals 1-3.
 */

import type { HistoricalAgent, LLMClient } from "../agents/base-agent";
import { RationalAgent, EmpatheticAgent } from "../agents/baseline-agents";
import type { JudgeVerdict } from "../agents/judge-agent";
import { DebateSimulator, type DebateResult } from "./debate-simulator";
import { REGION_WEIGHTS, type RegionWeights } from "../scoring/policy-scoring";

export const EXPERIMENT_TOPICS = [
  "war",
  "immigration",
  "socialism",
  "territorial_disputes",
  "economic_policy",
];

export interface ExperimentConfig {
  name: string;
  description: string;
  agents: HistoricalAgent[];
  topic: string;
  maxRounds?: number;
  consensusThreshold?: number;
  useJudge?: boolean;
  empathyInjection?: Record<string, number>;
  regionWeights?: RegionWeights;
  numSimulations?: number;
}

export interface ExperimentResult {
  configName: string;
  topic: string;
  debateResult: DebateResult;
  judgeVerdict: JudgeVerdict | null;
  scorecards: Record<string, Record<string, unknown>>;
  durationSeconds: number;
  empathyRatios: Record<string, number>;
  convergenceRound: number | null;
}

export function experimentResultAsDict(r: ExperimentResult): Record<string, unknown> {
  return {
    experiment: r.configName,
    topic: r.topic,
    status: r.debateResult.status,
    consensus_score: Math.round(r.debateResult.consensusScore * 10000) / 10000,
    rounds_played: r.debateResult.rounds.length,
    duration_seconds: Math.round(r.durationSeconds * 100) / 100,
    empathy_ratios: Object.fromEntries(
      Object.entries(r.empathyRatios).map(([k, v]) => [k, Math.round(v * 1000) / 1000]),
    ),
    convergence_round: r.convergenceRound,
    scorecards: r.scorecards,
    judge_verdict: r.judgeVerdict ?? null,
    agreements: r.debateResult.keyAgreements,
    disagreements: r.debateResult.keyDisagreements,
  };
}

export async function runExperiment(config: ExperimentConfig): Promise<ExperimentResult> {
  const start = Date.now();

  // Empathy injection
  if (config.empathyInjection) {
    for (const agent of config.agents) {
      if (agent.name in config.empathyInjection) {
        agent.injectEmpathy(config.empathyInjection[agent.name]);
      }
    }
  }

  const empathyRatios: Record<string, number> = {};
  for (const a of config.agents) empathyRatios[a.name] = a.empathyRatio;

  const simulator = new DebateSimulator({
    maxRounds: config.maxRounds ?? 15,
    consensusThreshold: config.consensusThreshold ?? 0.7,
  });

  const debateResult = await simulator.debate(config.agents, config.topic, {
    context: "Experiment simulation",
    policy_scoring: true,
  });

  // Rounds are scored inside the simulator (LLM judge when available,
  // content heuristic otherwise), so the verdict reflects the transcript.
  const judgeVerdict: JudgeVerdict | null = config.useJudge
    ? debateResult.judgeVerdict ?? null
    : null;
  const convergenceRound = judgeVerdict?.convergence_round ?? null;

  const scorecards: Record<string, Record<string, unknown>> = {};
  for (const a of config.agents) scorecards[a.name] = a.scorecard.asDict();

  return {
    configName: config.name,
    topic: config.topic,
    debateResult,
    judgeVerdict,
    scorecards,
    durationSeconds: (Date.now() - start) / 1000,
    empathyRatios,
    convergenceRound,
  };
}

export function getExperimentConfigs(opts?: {
  topic?: string;
  historicalAgents?: HistoricalAgent[];
  maxRounds?: number;
  llmClient?: LLMClient | null;
}): ExperimentConfig[] {
  const topic = opts?.topic ?? "war";
  const maxRounds = opts?.maxRounds ?? 15;
  const llmClient = opts?.llmClient ?? null;
  const configs: ExperimentConfig[] = [];

  configs.push({
    name: "1_rational_vs_rational",
    description: "Two purely rational agents negotiate to maximize their own points",
    agents: [new RationalAgent({ name: "Rational-A", llmClient }), new RationalAgent({ name: "Rational-B", llmClient })],
    topic,
    maxRounds,
    useJudge: true,
  });

  configs.push({
    name: "2_empathetic_vs_empathetic",
    description: "Two empathetic agents seek mutual benefit",
    agents: [
      new EmpatheticAgent({ name: "Empathetic-A", empathyRatio: 0.6, llmClient }),
      new EmpatheticAgent({ name: "Empathetic-B", empathyRatio: 0.6, llmClient }),
    ],
    topic,
    maxRounds,
    useJudge: true,
  });

  configs.push({
    name: "3_rational_vs_empathetic",
    description: "Rational agent faces empathetic agent — asymmetric empathy",
    agents: [
      new RationalAgent({ name: "Rational", llmClient }),
      new EmpatheticAgent({ name: "Empathetic", empathyRatio: 0.6, llmClient }),
    ],
    topic,
    maxRounds,
    useJudge: true,
  });

  configs.push({
    name: "4_low_empathy_vs_high_empathy",
    description: "Low-empathy (0.2) vs high-empathy (0.8) agents",
    agents: [
      new EmpatheticAgent({ name: "Low-Empathy", empathyRatio: 0.2, llmClient }),
      new EmpatheticAgent({ name: "High-Empathy", empathyRatio: 0.8, llmClient }),
    ],
    topic,
    maxRounds,
    useJudge: true,
  });

  const historicalAgents = opts?.historicalAgents;
  if (historicalAgents && historicalAgents.length >= 2) {
    const [a1, a2] = historicalAgents;
    const lessEmpathetic = a1.empathyRatio < a2.empathyRatio ? a1 : a2;

    configs.push({
      name: "5_historical_conflict",
      description: `${a1.name} vs ${a2.name} — unmodified historical personas`,
      agents: [a1, a2],
      topic,
      maxRounds,
      useJudge: true,
    });

    configs.push({
      name: "6_historical_empathy_injection",
      description: `Same as exp 5 but inject +0.3 empathy into ${lessEmpathetic.name}`,
      agents: [a1, a2],
      topic,
      maxRounds,
      useJudge: true,
      empathyInjection: { [lessEmpathetic.name]: 0.3 },
    });

    configs.push({
      name: "7_historical_judged",
      description: `${a1.name} vs ${a2.name} with comprehensive Judge evaluation`,
      agents: [a1, a2],
      topic,
      maxRounds,
      useJudge: true,
    });

    configs.push({
      name: "8_full_pipeline",
      description: "Full pipeline: historical agents + empathy injection + judge + policy scoring",
      agents: [a1, a2],
      topic,
      maxRounds,
      useJudge: true,
      empathyInjection: { [lessEmpathetic.name]: 0.4 },
      regionWeights: REGION_WEIGHTS.conflict_zone,
    });
  }

  return configs;
}
