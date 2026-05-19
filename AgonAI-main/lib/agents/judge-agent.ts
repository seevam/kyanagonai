/**
 * Judge/Mediator agent — non-participating evaluator.
 */

import { type RegionWeights, REGION_WEIGHTS } from "../scoring/policy-scoring";
import type { HistoricalAgent } from "./base-agent";

export interface JudgeVerdict {
  winner: string | null;
  margin: number;
  scorecards: Record<string, Record<string, unknown>>;
  empathy_analysis: Record<string, Record<string, unknown>>;
  convergence_round: number | null;
  convergence_metric: number;
  policy_breakdown: Record<string, Record<string, unknown>>;
  recommendations: string[];
}

export class JudgeAgent {
  private regionWeights: RegionWeights;

  constructor(regionWeights?: RegionWeights) {
    this.regionWeights = regionWeights ?? REGION_WEIGHTS.default;
  }

  evaluate(
    agents: HistoricalAgent[],
    _rounds: Record<string, unknown>[],
    topic: string,
  ): JudgeVerdict {
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

    return {
      winner,
      margin: Math.round(margin * 100) / 100,
      scorecards,
      empathy_analysis: empathyAnalysis,
      convergence_round: convergenceRound,
      convergence_metric: Math.round(convergenceMetric * 1000) / 1000,
      policy_breakdown: policyBreakdown,
      recommendations,
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
