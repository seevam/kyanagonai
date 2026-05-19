import { REGION_WEIGHTS } from "../scoring/policy-scoring";
import {
  HistoricalAgent,
  Ideology,
  type LLMClient,
  type MemoryClient,
  type ProposalEvaluation,
} from "./base-agent";

export class GandhiAgent extends HistoricalAgent {
  constructor(opts?: { llmClient?: LLMClient | null; memoryClient?: MemoryClient | null }) {
    super({
      name: "Mahatma Gandhi",
      ideology: Ideology.NONVIOLENCE,
      personality: {
        assertiveness: 0.7,
        cooperativeness: 0.95,
        opennessToChange: 0.8,
        emotionalStability: 0.9,
        dominance: 0.3,
        charisma: 0.9,
        pragmatism: 0.6,
        idealism: 0.98,
      },
      context: {
        timePeriod: "1920s-1940s",
        majorEvents: [
          "Salt March", "Quit India Movement", "Partition of India",
          "World War I", "World War II", "Indian Independence Movement",
          "Non-Cooperation Movement", "Civil Disobedience Movement",
        ],
        culturalBackground: "Hindu, Indian nationalist",
        education: "Law degree from London",
        keyRelationships: ["Jawaharlal Nehru", "Muhammad Ali Jinnah", "Kasturba Gandhi"],
        definingMoments: [
          "Experiences in South Africa", "Champaran Satyagraha",
          "Salt March", "Fasting for Hindu-Muslim unity",
        ],
      },
      llmClient: opts?.llmClient,
      memoryClient: opts?.memoryClient,
    });

    this.personalityMultiplier = 0.85;
    this.regionWeights = REGION_WEIGHTS.democratic;
    this.redLines = [
      "Non-violence (Ahimsa) as the only path to truth",
      "Unity of all religions and communities",
      "Self-reliance and simplicity",
      "Truth and honesty in all dealings",
      "Respect for all human life",
    ];
    this.currentPosition = {
      territorial_disputes: "All disputes should be resolved through peaceful dialogue and mutual understanding",
      race_relations: "All human beings are equal in the eyes of God, regardless of race or religion",
      economic_policy: "Self-reliance through village industries and simple living",
      military_strategy: "Non-violent resistance and civil disobedience",
      international_relations: "Peaceful coexistence and mutual respect between all nations",
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
