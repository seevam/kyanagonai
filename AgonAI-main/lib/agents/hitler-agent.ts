import { REGION_WEIGHTS } from "../scoring/policy-scoring";
import {
  HistoricalAgent,
  Ideology,
  type LLMClient,
  type MemoryClient,
  type ProposalEvaluation,
} from "./base-agent";

export class HitlerAgent extends HistoricalAgent {
  constructor(opts?: { llmClient?: LLMClient | null; memoryClient?: MemoryClient | null }) {
    super({
      name: "Adolf Hitler",
      ideology: Ideology.FASCISM,
      personality: {
        assertiveness: 0.95,
        cooperativeness: 0.1,
        opennessToChange: 0.05,
        emotionalStability: 0.3,
        dominance: 0.98,
        charisma: 0.85,
        pragmatism: 0.4,
        idealism: 0.9,
      },
      context: {
        timePeriod: "1930s-1940s",
        majorEvents: [
          "World War I", "Treaty of Versailles", "Great Depression",
          "Rise of Nazi Party", "Kristallnacht", "Invasion of Poland",
          "Holocaust", "World War II",
        ],
        culturalBackground: "German nationalist, anti-Semitic",
        education: "Self-taught, military service",
        keyRelationships: ["Goebbels", "Himmler", "Göring", "Eva Braun"],
        definingMoments: [
          "Beer Hall Putsch", "Mein Kampf", "Appointment as Chancellor",
          "Night of Long Knives", "Invasion of Soviet Union",
        ],
      },
      llmClient: opts?.llmClient,
      memoryClient: opts?.memoryClient,
    });

    this.personalityMultiplier = 1.3;
    this.regionWeights = REGION_WEIGHTS.authoritarian;
    this.redLines = [
      "German territorial expansion (Lebensraum)",
      "Superiority of Aryan race",
      "Destruction of communism",
      "Annexation of Austria and Sudetenland",
    ];
    this.currentPosition = {
      territorial_disputes: "Germany has the right to expand eastward for living space",
      race_relations: "Aryan race is superior",
      economic_policy: "Autarky and state control of economy",
      military_strategy: "Blitzkrieg tactics, total war",
      international_relations: "Germany first, alliances only if beneficial",
    };
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
