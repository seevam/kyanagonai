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
// Topic base scores
// ---------------------------------------------------------------------------

const TOPIC_BASE_SCORES: Record<string, Record<string, [number, number]>> = {
  territorial_disputes: { political: [70, 55], economic: [40, 60], social: [30, 65] },
  race_relations: { political: [50, 40], economic: [35, 30], social: [75, 50] },
  economic_policy: { political: [45, 35], economic: [80, 50], social: [55, 40] },
  partition_of_india: { political: [65, 60], economic: [40, 55], social: [35, 70] },
  war: { political: [75, 65], economic: [30, 80], social: [20, 85] },
  immigration: { political: [55, 50], economic: [60, 45], social: [65, 55] },
  socialism: { political: [50, 45], economic: [55, 60], social: [70, 40] },
};

function ideologyShifts(ideology: string): Record<string, [number, number]> {
  const shifts: Record<string, Record<string, [number, number]>> = {
    fascism: { political: [30, -15], economic: [5, 20], social: [-35, 35] },
    nonviolence: { political: [-15, -30], economic: [-5, -20], social: [35, -35] },
    muslim_nationalism: { political: [20, 10], economic: [10, -5], social: [10, 15] },
    communism: { political: [10, 20], economic: [20, 25], social: [25, 5] },
    democracy: { political: [15, -15], economic: [5, -5], social: [25, -20] },
    capitalism: { political: [-5, 10], economic: [35, 15], social: [-15, 20] },
    authoritarianism: { political: [35, -10], economic: [5, 15], social: [-30, 30] },
    liberalism: { political: [10, -10], economic: [15, 5], social: [25, -20] },
    conservatism: { political: [20, -5], economic: [15, 10], social: [-5, 10] },
  };
  return shifts[ideology.toLowerCase()] ?? { political: [0, 0], economic: [0, 0], social: [0, 0] };
}

// ---------------------------------------------------------------------------
// Scoring functions
// ---------------------------------------------------------------------------

export function scoreProposal(
  topic: string,
  agentIdeology: string,
  personalityModifier = 0,
  cooperationLevel = 0.5,
): PolicyScores {
  const base = TOPIC_BASE_SCORES[topic] ?? {
    political: [50, 50] as [number, number],
    economic: [50, 50] as [number, number],
    social: [50, 50] as [number, number],
  };

  const shifts = ideologyShifts(agentIdeology);
  const dims: Record<string, PolicyDimension> = {};

  for (const dimName of ["political", "economic", "social"] as const) {
    const [b, c] = base[dimName];
    const shift = shifts[dimName] ?? [0, 0];
    const benefit = b + shift[0] + personalityModifier * 30;
    const cost = c + shift[1] - cooperationLevel * 25;
    dims[dimName] = new PolicyDimension(benefit, cost);
  }

  return new PolicyScores(dims.political, dims.economic, dims.social);
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
