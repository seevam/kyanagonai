import { OCEANTraits, type RegionWeights } from "../scoring/policy-scoring";
import {
  HistoricalAgent,
  Ideology,
  type LLMClient,
  type MemoryClient,
  type ProposalEvaluation,
} from "./base-agent";


const NEUTRAL_CONTEXT = {
  timePeriod: "contemporary",
  majorEvents: [] as string[],
  culturalBackground: "neutral",
  education: "",
  keyRelationships: [] as string[],
  definingMoments: [] as string[],
};

export class RationalAgent extends HistoricalAgent {
  constructor(opts?: {
    name?: string;
    ideology?: Ideology;
    llmClient?: LLMClient | null;
    memoryClient?: MemoryClient | null;
    regionWeights?: RegionWeights;
  }) {
    super({
      name: opts?.name ?? "Rational Agent",
      ideology: opts?.ideology ?? Ideology.DEMOCRACY,
      personality: {
        assertiveness: 0.7,
        cooperativeness: 0.3,
        opennessToChange: 0.5,
        emotionalStability: 0.9,
        dominance: 0.6,
        charisma: 0.4,
        pragmatism: 0.95,
        idealism: 0.2,
      },
      context: NEUTRAL_CONTEXT,
      llmClient: opts?.llmClient,
      memoryClient: opts?.memoryClient,
      oceanOverride: new OCEANTraits(0.5, 0.8, 0.4, 0.2, 0.1),
      empathyRatio: 0.0,
      regionWeights: opts?.regionWeights,
    });
    this.redLines = [];
  }

  async generateResponse(
    topic: string,
    otherAgents: HistoricalAgent[],
    debateContext: Record<string, unknown>,
  ): Promise<string> {
    return this.generateLLMResponse(topic, otherAgents, debateContext);
  }

  async evaluateProposal(proposal: string, proposer: HistoricalAgent): Promise<ProposalEvaluation> {
    return this.evaluateProposalGenerically(proposal, proposer);
  }
}

export class EmpatheticAgent extends HistoricalAgent {
  constructor(opts?: {
    name?: string;
    ideology?: Ideology;
    empathyRatio?: number;
    llmClient?: LLMClient | null;
    memoryClient?: MemoryClient | null;
    regionWeights?: RegionWeights;
  }) {
    super({
      name: opts?.name ?? "Empathetic Agent",
      ideology: opts?.ideology ?? Ideology.DEMOCRACY,
      personality: {
        assertiveness: 0.4,
        cooperativeness: 0.9,
        opennessToChange: 0.8,
        emotionalStability: 0.7,
        dominance: 0.2,
        charisma: 0.7,
        pragmatism: 0.5,
        idealism: 0.8,
      },
      context: NEUTRAL_CONTEXT,
      llmClient: opts?.llmClient,
      memoryClient: opts?.memoryClient,
      oceanOverride: new OCEANTraits(0.8, 0.5, 0.6, 0.85, 0.3),
      empathyRatio: opts?.empathyRatio ?? 0.6,
      regionWeights: opts?.regionWeights,
    });
    this.redLines = [];
  }

  async generateResponse(
    topic: string,
    otherAgents: HistoricalAgent[],
    debateContext: Record<string, unknown>,
  ): Promise<string> {
    return this.generateLLMResponse(topic, otherAgents, debateContext);
  }

  async evaluateProposal(proposal: string, proposer: HistoricalAgent): Promise<ProposalEvaluation> {
    const result = await this.evaluateProposalGenerically(proposal, proposer);
    if (!result.accept) {
      const score = this.calculateConsensusScore(proposer);
      if (score >= 0.25) {
        result.accept = true;
      }
    }
    return result;
  }
}
