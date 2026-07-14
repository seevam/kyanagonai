/**
 * Judge/Mediator agent — non-participating evaluator.
 */

import {
  type RegionWeights,
  REGION_WEIGHTS,
  PolicyDimension,
  PolicyScores,
} from "../scoring/policy-scoring";
import type { HistoricalAgent, LLMClient } from "./base-agent";

export interface TranscriptAnalysis {
  convergence_trend: number;
  concessions_made: number;
  most_empathetic_agent: string;
  key_turning_point: string;
}

export interface JudgeRoundScore {
  scores: PolicyScores;
  rationale: string;
}

export interface JudgeVerdict {
  winner: string | null;
  margin: number;
  scorecards: Record<string, Record<string, unknown>>;
  empathy_analysis: Record<string, Record<string, unknown>>;
  convergence_round: number | null;
  convergence_metric: number;
  policy_breakdown: Record<string, Record<string, unknown>>;
  recommendations: string[];
  transcript_analysis?: TranscriptAnalysis;
  /** How the per-round policy scores were derived. */
  scoring_method?: "llm_judge" | "content_heuristic";
}

export class JudgeAgent {
  private regionWeights: RegionWeights;
  private llmClient: LLMClient | null;

  constructor(regionWeights?: RegionWeights, llmClient?: LLMClient | null) {
    this.regionWeights = regionWeights ?? REGION_WEIGHTS.default;
    this.llmClient = llmClient ?? null;
  }

  /**
   * Score every debate response on actual debate performance, using the LLM.
   * The judge is explicitly ideology-blind: it grades what was said in this
   * transcript, not who said it. Returns one entry per round (aligned by
   * index), or null if no LLM is available or every batch failed.
   */
  async scoreRounds(
    topic: string,
    rounds: { speaker: string; response: string }[],
  ): Promise<(JudgeRoundScore | null)[] | null> {
    if (!this.llmClient || !rounds.length) return null;

    const system = [
      "You are an impartial debate judge scoring individual debate responses.",
      "Judge ONLY the debate performance shown in the text: relevance to the topic, argument quality, use of evidence, direct engagement with opponents' points, persuasiveness, and constructive proposals.",
      "Do NOT reward or penalize any speaker for their ideology, historical identity, or reputation — identical words must receive identical scores regardless of the speaker.",
      "Respond ONLY with a valid JSON array, no markdown, no explanation.",
    ].join("\n");

    const BATCH_SIZE = 8;
    const results: (JudgeRoundScore | null)[] = new Array(rounds.length).fill(null);
    let anySucceeded = false;

    for (let start = 0; start < rounds.length; start += BATCH_SIZE) {
      const batch = rounds.slice(start, start + BATCH_SIZE);
      const numbered = batch
        .map((r, i) => `[${i + 1}] ${r.speaker}: ${r.response.slice(0, 400)}`)
        .join("\n\n");

      const prompt = [
        `Debate topic: "${topic}"`,
        "",
        "Score each numbered response below. For each, give integers 0-100:",
        "- political benefit/cost: legitimacy and persuasive power gained vs credibility lost",
        "- economic benefit/cost: strength of material/practical arguments vs unaddressed practical weaknesses",
        "- social benefit/cost: goodwill, empathy and common ground earned vs hostility and alienation caused",
        "A vague, off-topic, or purely repetitive response should score low benefits. A specific, on-topic, well-evidenced or genuinely conciliatory response should score high benefits.",
        "",
        "RESPONSES:",
        numbered,
        "",
        `Reply ONLY with a JSON array of exactly ${batch.length} objects:`,
        '[{"n": 1, "political": [benefit, cost], "economic": [benefit, cost], "social": [benefit, cost], "rationale": "one short sentence"}, ...]',
      ].join("\n");

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const raw = await this.llmClient.generate(prompt, system, {
            temperature: attempt === 0 ? 0.2 : 0.0,
            max_tokens: 1200,
          });
          if (!raw?.trim()) continue;
          const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "");
          const match = cleaned.match(/\[[\s\S]*\]/);
          if (!match) continue;
          const parsed = JSON.parse(match[0]);
          if (!Array.isArray(parsed)) continue;

          for (const item of parsed) {
            const idx = start + (Number(item?.n) - 1);
            if (idx < start || idx >= start + batch.length) continue;
            const dims: Record<string, PolicyDimension> = {};
            let valid = true;
            for (const dim of ["political", "economic", "social"] as const) {
              const pair = item?.[dim];
              if (!Array.isArray(pair) || typeof pair[0] !== "number" || typeof pair[1] !== "number") {
                valid = false;
                break;
              }
              dims[dim] = new PolicyDimension(pair[0], pair[1]);
            }
            if (!valid) continue;
            results[idx] = {
              scores: new PolicyScores(dims.political, dims.economic, dims.social),
              rationale: typeof item?.rationale === "string" ? item.rationale : "",
            };
            anySucceeded = true;
          }
          break;
        } catch {
          // retry
        }
      }
    }

    return anySucceeded ? results : null;
  }

  private async analyzeTranscript(
    transcript: string,
    agentNames: string[],
  ): Promise<TranscriptAnalysis | undefined> {
    if (!this.llmClient || !transcript.trim()) return undefined;

    const system = [
      "You are an impartial academic judge evaluating a political debate transcript.",
      "Respond ONLY with a valid JSON object, no markdown, no explanation.",
    ].join("\n");

    const prompt = [
      "Analyze this debate transcript and return a JSON object with exactly these fields:",
      '  "convergence_trend": number 0-1 (0 = pure divergence, 1 = full convergence)',
      '  "concessions_made": integer count of genuine concessions made across all agents',
      `  "most_empathetic_agent": string — the name of the agent from [${agentNames.join(", ")}] who showed the most cognitive empathy`,
      '  "key_turning_point": string — one sentence describing the key turning point, or "None identified" if absent',
      "",
      "TRANSCRIPT:",
      transcript.slice(0, 6000),
      "",
      'Reply ONLY: {"convergence_trend": ..., "concessions_made": ..., "most_empathetic_agent": "...", "key_turning_point": "..."}',
    ].join("\n");

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await this.llmClient.generate(prompt, system, {
          temperature: attempt === 0 ? 0.3 : 0.1,
          max_tokens: 300,
        });
        if (!raw?.trim()) continue;
        const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "");
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (
            typeof parsed.convergence_trend === "number" &&
            typeof parsed.concessions_made === "number" &&
            typeof parsed.most_empathetic_agent === "string" &&
            typeof parsed.key_turning_point === "string"
          ) {
            return {
              convergence_trend: Math.max(0, Math.min(1, parsed.convergence_trend)),
              concessions_made: Math.max(0, parsed.concessions_made),
              most_empathetic_agent: parsed.most_empathetic_agent,
              key_turning_point: parsed.key_turning_point,
            };
          }
        }
      } catch {
        // retry
      }
    }
    return undefined;
  }

  async evaluate(
    agents: HistoricalAgent[],
    _rounds: Record<string, unknown>[],
    transcriptOrTopic: string,
  ): Promise<JudgeVerdict> {
    const topic = transcriptOrTopic.length < 120 ? transcriptOrTopic : "";
    const transcript = transcriptOrTopic.length >= 120 ? transcriptOrTopic : "";
    const scorecards: Record<string, Record<string, unknown>> = {};
    for (const a of agents) scorecards[a.name] = a.scorecard.asDict();

    const bestAgent = agents.reduce((best, a) =>
      a.scorecard.finalObjective > best.scorecard.finalObjective ? a : best,
    );
    const worstAgent = agents.reduce((worst, a) =>
      a.scorecard.finalObjective < worst.scorecard.finalObjective ? a : worst,
    );
    const margin = bestAgent.scorecard.finalObjective - worstAgent.scorecard.finalObjective;
    const winner = margin > 1.0 ? bestAgent.name : null;

    const empathyAnalysis: Record<string, Record<string, unknown>> = {};
    for (const a of agents) {
      empathyAnalysis[a.name] = {
        empathy_ratio: Math.round(a.empathyRatio * 1000) / 1000,
        empathy_bonus: Math.round(a.scorecard.empathyBonus * 100) / 100,
        ocean: a.ocean.asDict(),
        fatigue_final: Math.round(a.fatigue * 10000) / 10000,
        penalties: Math.round(a.scorecard.penalties * 100) / 100,
      };
    }

    let convergenceRound: number | null = null;
    let convergenceMetric = 0;
    if (agents.length === 2) {
      const [a1, a2] = agents;
      const len = Math.min(a1.scorecard.objectiveValues.length, a2.scorecard.objectiveValues.length);
      for (let i = 0; i < len; i++) {
        const v1 = a1.scorecard.objectiveValues[i];
        const v2 = a2.scorecard.objectiveValues[i];
        const diff = Math.abs(v1 - v2);
        const avg = (Math.abs(v1) + Math.abs(v2)) / 2 || 1;
        const relativeDiff = diff / avg;
        if (relativeDiff < 0.1) {
          convergenceRound = i + 1;
          convergenceMetric = 1.0 - relativeDiff;
          break;
        }
      }
      if (
        convergenceRound === null &&
        a1.scorecard.objectiveValues.length &&
        a2.scorecard.objectiveValues.length
      ) {
        const v1 = a1.scorecard.objectiveValues[a1.scorecard.objectiveValues.length - 1];
        const v2 = a2.scorecard.objectiveValues[a2.scorecard.objectiveValues.length - 1];
        const avg = (Math.abs(v1) + Math.abs(v2)) / 2 || 1;
        convergenceMetric = Math.max(0, 1.0 - Math.abs(v1 - v2) / avg);
      }
    }

    const policyBreakdown: Record<string, Record<string, unknown>> = {};
    for (const a of agents) {
      const cs = a.scorecard.cumulativeScores;
      policyBreakdown[a.name] = {
        political: { benefit: Math.round(cs.political.benefit * 10) / 10, cost: Math.round(cs.political.cost * 10) / 10, net: Math.round(cs.political.net * 10) / 10 },
        economic: { benefit: Math.round(cs.economic.benefit * 10) / 10, cost: Math.round(cs.economic.cost * 10) / 10, net: Math.round(cs.economic.net * 10) / 10 },
        social: { benefit: Math.round(cs.social.benefit * 10) / 10, cost: Math.round(cs.social.cost * 10) / 10, net: Math.round(cs.social.net * 10) / 10 },
      };
    }

    const recommendations = this.generateRecommendations(agents, convergenceRound, topic);

    // Bug 7: LLM-based transcript analysis
    const transcriptAnalysis = transcript
      ? await this.analyzeTranscript(transcript, agents.map((a) => a.name))
      : undefined;

    return {
      winner,
      margin: Math.round(margin * 100) / 100,
      scorecards,
      empathy_analysis: empathyAnalysis,
      convergence_round: convergenceRound,
      convergence_metric: Math.round(convergenceMetric * 1000) / 1000,
      policy_breakdown: policyBreakdown,
      recommendations,
      transcript_analysis: transcriptAnalysis,
    };
  }

  private generateRecommendations(
    agents: HistoricalAgent[],
    convergenceRound: number | null,
    topic: string,
  ): string[] {
    const recs: string[] = [];

    const highEmpathy = agents.filter((a) => a.empathyRatio > 0.4);
    const lowEmpathy = agents.filter((a) => a.empathyRatio <= 0.4);

    if (highEmpathy.length && lowEmpathy.length) {
      const heAvg =
        highEmpathy.reduce((s, a) => s + a.scorecard.finalObjective, 0) / highEmpathy.length;
      const leAvg =
        lowEmpathy.reduce((s, a) => s + a.scorecard.finalObjective, 0) / lowEmpathy.length;
      if (heAvg > leAvg) {
        recs.push(
          `Higher empathy agents averaged ${heAvg.toFixed(1)} vs ${leAvg.toFixed(1)} — empathy correlated with better outcomes on '${topic}'.`,
        );
      } else {
        recs.push(
          `Lower empathy agents performed better (${leAvg.toFixed(1)} vs ${heAvg.toFixed(1)}) — pure rationality may be more effective on '${topic}'.`,
        );
      }
    }

    if (convergenceRound) {
      recs.push(
        `Agents converged at round ${convergenceRound}. Earlier convergence suggests productive dialogue.`,
      );
    } else {
      recs.push("No convergence detected. Consider increasing empathy or adjusting topic framing.");
    }

    for (const a of agents) {
      if (a.fatigue > 0.5) {
        recs.push(
          `${a.name} showed high fatigue (${a.fatigue.toFixed(2)}). Consider shorter debates or higher emotional stability.`,
        );
      }
      if (a.scorecard.penalties > 20) {
        recs.push(
          `${a.name} accumulated ${a.scorecard.penalties.toFixed(0)} penalty points. Review red-line violations and cooperation.`,
        );
      }
    }

    return recs;
  }
}
