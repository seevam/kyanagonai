/**
 * Policy scoring system for multi-dimensional benefit-cost analysis.
 *
 * Each proposal/position is scored across three policy dimensions:
 *   - Political  (benefit 0-100, cost 0-100)
 *   - Economic   (benefit 0-100, cost 0-100)
 *   - Social     (benefit 0-100, cost 0-100)
 */

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

export interface PolicyDimensionData {
  benefit: number;
  cost: number;
  net: number;
}

export class PolicyDimension {
  benefit: number;
  cost: number;

  constructor(benefit = 50, cost = 50) {
    this.benefit = clamp100(benefit);
    this.cost = clamp100(cost);
  }

  get net(): number {
    return this.benefit - this.cost;
  }
}

export class PolicyScores {
  political: PolicyDimension;
  economic: PolicyDimension;
  social: PolicyDimension;

  constructor(
    political?: PolicyDimension,
    economic?: PolicyDimension,
    social?: PolicyDimension,
  ) {
    this.political = political ?? new PolicyDimension();
    this.economic = economic ?? new PolicyDimension();
    this.social = social ?? new PolicyDimension();
  }

  get totalBenefit(): number {
    return this.political.benefit + this.economic.benefit + this.social.benefit;
  }

  get totalCost(): number {
    return this.political.cost + this.economic.cost + this.social.cost;
  }

  get totalNet(): number {
    return this.totalBenefit - this.totalCost;
  }

  asDict(): Record<string, unknown> {
    return {
      political: { benefit: this.political.benefit, cost: this.political.cost, net: this.political.net },
      economic: { benefit: this.economic.benefit, cost: this.economic.cost, net: this.economic.net },
      social: { benefit: this.social.benefit, cost: this.social.cost, net: this.social.net },
      total_benefit: this.totalBenefit,
      total_cost: this.totalCost,
      total_net: this.totalNet,
    };
  }
}

export class RegionWeights {
  political: number;
  economic: number;
  social: number;

  constructor(political = 0.33, economic = 0.34, social = 0.33) {
    const total = political + economic + social;
    if (total > 0) {
      this.political = political / total;
      this.economic = economic / total;
      this.social = social / total;
    } else {
      this.political = political;
      this.economic = economic;
      this.social = social;
    }
  }
}

export const REGION_WEIGHTS: Record<string, RegionWeights> = {
  default: new RegionWeights(0.33, 0.34, 0.33),
  authoritarian: new RegionWeights(0.50, 0.30, 0.20),
  democratic: new RegionWeights(0.25, 0.30, 0.45),
  developing: new RegionWeights(0.20, 0.50, 0.30),
  conflict_zone: new RegionWeights(0.45, 0.25, 0.30),
};

export class AgentScorecard {
  agentName: string;
  roundsPlayed = 0;
  cumulativeScores: PolicyScores = new PolicyScores();
  roundScores: PolicyScores[] = [];
  roundRationales: string[] = [];
  objectiveValues: number[] = [];
  fatigue = 0;
  empathyBonus = 0;
  penalties = 0;

  constructor(agentName: string) {
    this.agentName = agentName;
  }

  get finalObjective(): number {
    if (!this.objectiveValues.length) return 0;
    return this.objectiveValues.reduce((a, b) => a + b, 0);
  }

  asDict(): Record<string, unknown> {
    return {
      agent_name: this.agentName,
      rounds_played: this.roundsPlayed,
      cumulative_scores: this.cumulativeScores.asDict(),
      final_objective: Math.round(this.finalObjective * 100) / 100,
      fatigue: Math.round(this.fatigue * 10000) / 10000,
      empathy_bonus: Math.round(this.empathyBonus * 100) / 100,
      penalties: Math.round(this.penalties * 100) / 100,
      round_history: this.roundScores.map((s) => s.asDict()),
      round_rationales: this.roundRationales,
    };
  }
}

// ---------------------------------------------------------------------------
// OCEAN personality traits
// ---------------------------------------------------------------------------

export class OCEANTraits {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;

  constructor(
    openness = 0.5,
    conscientiousness = 0.5,
    extraversion = 0.5,
    agreeableness = 0.5,
    neuroticism = 0.5,
  ) {
    this.openness = openness;
    this.conscientiousness = conscientiousness;
    this.extraversion = extraversion;
    this.agreeableness = agreeableness;
    this.neuroticism = neuroticism;
  }

  empathyScore(): number {
    const score =
      this.agreeableness * 0.45 +
      this.openness * 0.25 +
      this.extraversion * 0.15 +
      (1.0 - this.neuroticism) * 0.10 +
      this.conscientiousness * 0.05;
    return Math.max(0, Math.min(1, score));
  }

  personalityModifier(): number {
    return (
      (this.agreeableness - 0.5) * 0.6 +
      (this.openness - 0.5) * 0.3 +
      (this.conscientiousness - 0.5) * 0.15 -
      (this.neuroticism - 0.5) * 0.15
    );
  }

  asDict(): Record<string, number> {
    return {
      openness: Math.round(this.openness * 100) / 100,
      conscientiousness: Math.round(this.conscientiousness * 100) / 100,
      extraversion: Math.round(this.extraversion * 100) / 100,
      agreeableness: Math.round(this.agreeableness * 100) / 100,
      neuroticism: Math.round(this.neuroticism * 100) / 100,
      empathy_score: Math.round(this.empathyScore() * 1000) / 1000,
    };
  }
}

// ---------------------------------------------------------------------------
// Content-based round scoring (heuristic fallback when no LLM judge)
// ---------------------------------------------------------------------------

const COOPERATION_MARKERS = [
  "agree", "common ground", "compromise", "concede", "concession", "you're right",
  "you are right", "fair point", "understand your", "willing to", "together",
  "mutual", "shared", "accept your", "acknowledge",
];

const AGGRESSION_MARKERS = [
  "never", "refuse", "demand", "destroy", "crush", "enemy", "weakness",
  "surrender", "unacceptable", "threat", "force", "war", "annihilat",
];

const PROPOSAL_MARKERS = [
  "propose", "suggest", "offer", "plan", "framework", "solution", "let us",
  "we could", "we should", "how about", "what if", "alternative",
];

const EVIDENCE_MARKERS = [
  "because", "history shows", "for example", "evidence", "consider", "in fact",
  "as we saw", "experience", "demonstrat", "proven", "record shows",
];

function countMarkers(text: string, markers: string[]): number {
  let n = 0;
  for (const m of markers) if (text.includes(m)) n++;
  return n;
}

/**
 * Score a single debate response from its actual content. Every signal is
 * derived from the text itself — relevance to the topic, substance, evidence,
 * engagement, concrete proposals, cooperation vs aggression. No ideology or
 * identity of the speaker is consulted, so the same words score the same
 * regardless of who says them.
 */
export function scoreResponseContent(
  topic: string,
  responseText: string,
  cooperationLevel = 0.5,
): PolicyScores {
  const text = responseText.toLowerCase();
  const words = text.split(/\W+/).filter(Boolean);

  // Substance: enough said to constitute an argument (saturates ~50 words)
  const substance = Math.min(words.length / 50, 1);

  // Relevance: overlap between meaningful topic words and the response
  const topicWords = topic.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  let relevance = 0.5;
  if (topicWords.length) {
    const hits = topicWords.filter((w) => text.includes(w)).length;
    relevance = hits / topicWords.length;
  }

  const coop = Math.min(countMarkers(text, COOPERATION_MARKERS), 4);
  const aggression = Math.min(countMarkers(text, AGGRESSION_MARKERS), 4);
  const proposals = Math.min(countMarkers(text, PROPOSAL_MARKERS), 4);
  const evidence = Math.min(countMarkers(text, EVIDENCE_MARKERS), 4);
  const engagesOpponent = /\byou\b|\byour\b/.test(text) ? 1 : 0;

  const quality = substance * (0.4 + 0.6 * relevance); // 0..1

  const political = new PolicyDimension(
    35 + quality * 30 + evidence * 4 + proposals * 3 + engagesOpponent * 4,
    55 - quality * 15 - coop * 3 + aggression * 4 - cooperationLevel * 10,
  );
  const economic = new PolicyDimension(
    35 + quality * 30 + proposals * 5 + evidence * 3,
    55 - quality * 15 - proposals * 3 + aggression * 3 - cooperationLevel * 10,
  );
  const social = new PolicyDimension(
    35 + quality * 25 + coop * 6 + engagesOpponent * 4,
    55 - quality * 10 - coop * 5 + aggression * 6 - cooperationLevel * 10,
  );

  return new PolicyScores(political, economic, social);
}

export function computeObjective(
  scores: PolicyScores,
  weights?: RegionWeights,
  fatigue = 0,
  penalty = 0,
): number {
  const w = weights ?? REGION_WEIGHTS.default;
  const raw =
    w.political * scores.political.net +
    w.economic * scores.economic.net +
    w.social * scores.social.net;
  return raw * (1.0 - Math.min(fatigue, 0.95)) - penalty;
}

export function applyEmpathyMultiplier(
  ownObjective: number,
  opponentObjective: number,
  empathyRatio: number,
): number {
  const er = Math.max(0, Math.min(1, empathyRatio));
  return ownObjective * (1.0 - er) + opponentObjective * er;
}

export function applyFatiguePenalty(
  baseFatigue: number,
  roundNumber: number,
  emotionalStability = 0.5,
  maxRounds = 20,
): number {
  const progress = roundNumber / Math.max(maxRounds, 1);
  const stabilityFactor = 1.0 - emotionalStability * 0.6;
  const fatigue =
    baseFatigue +
    (1.0 / (1.0 + Math.exp(-8 * (progress - 0.6)))) * stabilityFactor * 0.4;
  return Math.min(fatigue, 0.95);
}

export function computePenalty(
  violatedRedLines = 0,
  lowCooperationRounds = 0,
  repeatedPositions = 0,
): number {
  return violatedRedLines * 15.0 + lowCooperationRounds * 5.0 + repeatedPositions * 3.0;
}
