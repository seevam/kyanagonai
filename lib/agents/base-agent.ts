/**
 * Base class for historical figure AI agents.
 */

import {
  OCEANTraits,
  PolicyScores,
  AgentScorecard,
  RegionWeights,
  REGION_WEIGHTS,
  scoreProposal,
  computeObjective,
  applyEmpathyMultiplier,
  applyFatiguePenalty,
  computePenalty,
} from "../scoring/policy-scoring";

export enum Ideology {
  FASCISM = "fascism",
  COMMUNISM = "communism",
  CAPITALISM = "capitalism",
  NONVIOLENCE = "nonviolence",
  MUSLIM_NATIONALISM = "muslim_nationalism",
  DEMOCRACY = "democracy",
  AUTHORITARIANISM = "authoritarianism",
  LIBERALISM = "liberalism",
  CONSERVATISM = "conservatism",
}

export interface PersonalityTraits {
  assertiveness: number;
  cooperativeness: number;
  opennessToChange: number;
  emotionalStability: number;
  dominance: number;
  charisma: number;
  pragmatism: number;
  idealism: number;
}

export interface HistoricalContext {
  timePeriod: string;
  majorEvents: string[];
  culturalBackground: string;
  education: string;
  keyRelationships: string[];
  definingMoments: string[];
}

export interface ProposalEvaluation {
  accept: boolean;
  reasoning: string;
  counter_proposal: string;
}

export interface LLMClient {
  generate(
    prompt: string,
    system?: string,
    options?: { temperature?: number; max_tokens?: number },
  ): Promise<string>;
}

export interface MemoryClient {
  recordEvent(
    agentName: string,
    speaker: string,
    content: string,
    metadata: Record<string, unknown>,
  ): void | Promise<void>;
  summarizeRecent(agentName: string, window?: number): string;
}

export interface ConversationEntry {
  speaker: string;
  content: string;
  context: Record<string, unknown>;
  timestamp: number;
}

export function personalityToOcean(p: PersonalityTraits): OCEANTraits {
  return new OCEANTraits(
    p.opennessToChange,
    (p.pragmatism + p.emotionalStability) / 2,
    (p.assertiveness + p.charisma) / 2,
    p.cooperativeness,
    1.0 - p.emotionalStability,
  );
}

const IDEOLOGY_MATRIX: Record<string, Record<string, number>> = {
  [Ideology.FASCISM]: {
    [Ideology.FASCISM]: 1.0, [Ideology.AUTHORITARIANISM]: 0.7, [Ideology.CONSERVATISM]: 0.5,
    [Ideology.COMMUNISM]: 0.2, [Ideology.DEMOCRACY]: 0.1, [Ideology.LIBERALISM]: 0.1,
    [Ideology.NONVIOLENCE]: 0.0, [Ideology.MUSLIM_NATIONALISM]: 0.3, [Ideology.CAPITALISM]: 0.4,
  },
  [Ideology.COMMUNISM]: {
    [Ideology.COMMUNISM]: 1.0, [Ideology.AUTHORITARIANISM]: 0.6, [Ideology.LIBERALISM]: 0.3,
    [Ideology.DEMOCRACY]: 0.2, [Ideology.CONSERVATISM]: 0.2, [Ideology.FASCISM]: 0.2,
    [Ideology.NONVIOLENCE]: 0.1, [Ideology.MUSLIM_NATIONALISM]: 0.2, [Ideology.CAPITALISM]: 0.1,
  },
  [Ideology.DEMOCRACY]: {
    [Ideology.DEMOCRACY]: 1.0, [Ideology.LIBERALISM]: 0.8, [Ideology.CONSERVATISM]: 0.6,
    [Ideology.NONVIOLENCE]: 0.7, [Ideology.COMMUNISM]: 0.2, [Ideology.AUTHORITARIANISM]: 0.1,
    [Ideology.FASCISM]: 0.1, [Ideology.MUSLIM_NATIONALISM]: 0.3, [Ideology.CAPITALISM]: 0.7,
  },
  [Ideology.NONVIOLENCE]: {
    [Ideology.NONVIOLENCE]: 1.0, [Ideology.DEMOCRACY]: 0.7, [Ideology.LIBERALISM]: 0.6,
    [Ideology.CONSERVATISM]: 0.4, [Ideology.COMMUNISM]: 0.1, [Ideology.AUTHORITARIANISM]: 0.0,
    [Ideology.FASCISM]: 0.0, [Ideology.MUSLIM_NATIONALISM]: 0.3, [Ideology.CAPITALISM]: 0.5,
  },
  [Ideology.MUSLIM_NATIONALISM]: {
    [Ideology.MUSLIM_NATIONALISM]: 1.0, [Ideology.CONSERVATISM]: 0.5, [Ideology.AUTHORITARIANISM]: 0.4,
    [Ideology.DEMOCRACY]: 0.3, [Ideology.LIBERALISM]: 0.2, [Ideology.COMMUNISM]: 0.2,
    [Ideology.FASCISM]: 0.1, [Ideology.NONVIOLENCE]: 0.3, [Ideology.CAPITALISM]: 0.4,
  },
  [Ideology.AUTHORITARIANISM]: {
    [Ideology.AUTHORITARIANISM]: 1.0, [Ideology.FASCISM]: 0.7, [Ideology.COMMUNISM]: 0.6,
    [Ideology.CONSERVATISM]: 0.6, [Ideology.MUSLIM_NATIONALISM]: 0.4, [Ideology.DEMOCRACY]: 0.1,
    [Ideology.LIBERALISM]: 0.1, [Ideology.NONVIOLENCE]: 0.0, [Ideology.CAPITALISM]: 0.3,
  },
  [Ideology.CONSERVATISM]: {
    [Ideology.CONSERVATISM]: 1.0, [Ideology.AUTHORITARIANISM]: 0.6, [Ideology.DEMOCRACY]: 0.6,
    [Ideology.FASCISM]: 0.5, [Ideology.MUSLIM_NATIONALISM]: 0.5, [Ideology.CAPITALISM]: 0.7,
    [Ideology.LIBERALISM]: 0.5, [Ideology.NONVIOLENCE]: 0.4, [Ideology.COMMUNISM]: 0.2,
  },
  [Ideology.LIBERALISM]: {
    [Ideology.LIBERALISM]: 1.0, [Ideology.DEMOCRACY]: 0.8, [Ideology.NONVIOLENCE]: 0.6,
    [Ideology.CONSERVATISM]: 0.5, [Ideology.CAPITALISM]: 0.8, [Ideology.COMMUNISM]: 0.3,
    [Ideology.MUSLIM_NATIONALISM]: 0.2, [Ideology.AUTHORITARIANISM]: 0.1, [Ideology.FASCISM]: 0.1,
  },
  [Ideology.CAPITALISM]: {
    [Ideology.CAPITALISM]: 1.0, [Ideology.LIBERALISM]: 0.8, [Ideology.DEMOCRACY]: 0.7,
    [Ideology.CONSERVATISM]: 0.7, [Ideology.NONVIOLENCE]: 0.5, [Ideology.MUSLIM_NATIONALISM]: 0.4,
    [Ideology.FASCISM]: 0.4, [Ideology.AUTHORITARIANISM]: 0.3, [Ideology.COMMUNISM]: 0.1,
  },
};

export abstract class HistoricalAgent {
  name: string;
  ideology: Ideology;
  personality: PersonalityTraits;
  context: HistoricalContext;
  llmClient: LLMClient | null;
  memoryClient: MemoryClient | null;
  conversationHistory: ConversationEntry[] = [];
  currentPosition: Record<string, string> = {};
  redLines: string[] = [];

  ocean: OCEANTraits;
  empathyRatio: number;
  fatigue = 0;
  regionWeights: RegionWeights;
  scorecard: AgentScorecard;
  personalityMultiplier = 1.0;

  constructor(opts: {
    name: string;
    ideology: Ideology;
    personality: PersonalityTraits;
    context: HistoricalContext;
    llmClient?: LLMClient | null;
    memoryClient?: MemoryClient | null;
    oceanOverride?: OCEANTraits;
    empathyRatio?: number;
    regionWeights?: RegionWeights;
  }) {
    this.name = opts.name;
    this.ideology = opts.ideology;
    this.personality = opts.personality;
    this.context = opts.context;
    this.llmClient = opts.llmClient ?? null;
    this.memoryClient = opts.memoryClient ?? null;
    this.ocean = opts.oceanOverride ?? personalityToOcean(opts.personality);
    this.empathyRatio = opts.empathyRatio ?? this.ocean.empathyScore();
    this.regionWeights = opts.regionWeights ?? REGION_WEIGHTS.default;
    this.scorecard = new AgentScorecard(opts.name);
  }

  abstract generateResponse(
    topic: string,
    otherAgents: HistoricalAgent[],
    debateContext: Record<string, unknown>,
  ): Promise<string>;

  abstract evaluateProposal(proposal: string, proposer: HistoricalAgent): Promise<ProposalEvaluation>;

  updatePosition(newPosition: Record<string, string>): void {
    Object.assign(this.currentPosition, newPosition);
  }

  addToHistory(speaker: string, content: string, context: Record<string, unknown>): void {
    this.conversationHistory.push({
      speaker,
      content,
      context,
      timestamp: this.conversationHistory.length,
    });
    if (this.memoryClient) {
      this.memoryClient.recordEvent(this.name, speaker, content, context);
    }
  }

  getMemorySummary(): string {
    if (!this.memoryClient) return "Memory service not configured.";
    return this.memoryClient.summarizeRecent(this.name);
  }

  protected generateFallbackResponse(_topic: string): string {
    throw new Error(`No LLM client configured for ${this.name}`);
  }

  updateEmpathy(response: string, opponents: HistoricalAgent[]): void {
    const responseLower = response.toLowerCase();
    let referencedOpponent = false;
    for (const opponent of opponents) {
      for (const entry of opponent.conversationHistory.slice(-3)) {
        const words = entry.content.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
        if (!words.length) continue;
        const overlap = words.filter((w) => responseLower.includes(w)).length;
        if (overlap / words.length > 0.25) {
          referencedOpponent = true;
          break;
        }
      }
      if (referencedOpponent) break;
    }
    const repeatedRedLine = this.redLines.some((rl) =>
      responseLower.includes(rl.toLowerCase().slice(0, 20)),
    );
    if (referencedOpponent) this.empathyRatio = Math.min(1, this.empathyRatio + 0.05);
    if (repeatedRedLine) this.empathyRatio = Math.max(0, this.empathyRatio - 0.05);
  }

  async generateLLMResponse(
    topic: string,
    otherAgents: HistoricalAgent[],
    debateContext: Record<string, unknown>,
  ): Promise<string> {
    if (!this.llmClient) return this.generateFallbackResponse(topic);

    const roundNum = this.conversationHistory.length;
    const numParticipants = otherAgents.length + 1;
    const isTwoPerson = numParticipants === 2;

    const convCtx = debateContext.conversation_context as Record<string, unknown> | undefined;
    const ctxMetrics = convCtx?.metrics as Record<string, unknown> | undefined;
    const empathyReservoir = (ctxMetrics?.empathy_reservoir as number) ?? 0;
    const escalationPrompt = debateContext.escalation_prompt as string | undefined;

    const lines: string[] = [];
    const myPrev: string[] = [];
    let otherLastMsg = "";
    for (const entry of this.conversationHistory.slice(-8)) {
      const speaker = entry.speaker;
      const content = entry.content;
      if (speaker === this.name) {
        myPrev.push(content);
        lines.push(`Me: ${content}`);
      } else if (isTwoPerson) {
        lines.push(`Them: ${content}`);
      } else {
        lines.push(`${speaker}: ${content}`);
      }
    }
    for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
      if (this.conversationHistory[i].speaker !== this.name) {
        otherLastMsg = this.conversationHistory[i].content;
        break;
      }
    }

    const chatLog = lines.join("\n");

    let phase: string;
    if (roundNum === 0) {
      phase = "This is your OPENING message. Introduce your stance on the topic.";
    } else if (roundNum < 4) {
      phase = "React to what they just said. Push back or agree, but add something new.";
    } else {
      phase = "Look for common ground. Offer a specific compromise or concession.";
    }

    const systemParts = [
      `You ARE ${this.name}. Speak only as "I". Never refer to yourself by name or in third person.`,
      `Ideology: ${this.ideology}.`,
      `Personality — assertive: ${this.personality.assertiveness}, cooperative: ${this.personality.cooperativeness}, dominant: ${this.personality.dominance}, pragmatic: ${this.personality.pragmatism}, open: ${this.personality.opennessToChange}.`,
    ];

    if (this.redLines.length) {
      systemParts.push(`Non-negotiable limits: ${this.redLines.join("; ")}.`);
    }

    // ---- Stakes and scoring context ----
    systemParts.push("");
    systemParts.push("Your objective in this debate:");
    systemParts.push("- You are trying to WIN by maximizing your political, economic, and social outcomes.");
    systemParts.push("- Political score: how much power and legitimacy your position gains.");
    systemParts.push("- Economic score: how much your side benefits materially from the outcome.");
    systemParts.push("- Social score: how much public support and moral authority your position earns.");
    systemParts.push(`- Your current empathy level is ${this.empathyRatio.toFixed(2)} out of 1.0. Higher empathy means you find common ground where it serves your interests.`);
    systemParts.push("- If the debate deadlocks with no progress, everyone loses points. Engage genuinely — do not just repeat yourself.");
    systemParts.push("- Acknowledging an opponent's point or making a genuine concession earns you social score and credibility, even if you disagree overall.");
    // ---- End stakes ----

    systemParts.push("");
    systemParts.push("Rules:");
    systemParts.push("- 1 to 3 short sentences, like a text message.");
    systemParts.push("- Do NOT start with any name, greeting, or 'My dear'.");
    if (isTwoPerson) {
      systemParts.push("- Address the other person as 'you', never by name.");
    }
    systemParts.push("- Respond to what THEY said, not to yourself.");
    systemParts.push("- Do not cite your own prior statements as external evidence. Only engage with what other agents have said.");
    systemParts.push("- Do not repeat an argument you or any agent has already made. Introduce a new point or respond to a specific claim from the transcript.");
    systemParts.push(`- If you catch yourself writing '${this.name} believes' or '${this.name} argues', rewrite it in first person instead.`);

    if (myPrev.length) {
      systemParts.push(
        `- You already said these things (say something COMPLETELY DIFFERENT — do NOT rephrase these): ${myPrev
          .slice(-5)
          .map((p) => p.slice(0, 100))
          .join(" | ")}`,
      );
    }

    if (empathyReservoir > 0.15) {
      systemParts.push("- You are currently inclined toward understanding the other side. Acknowledge one of their arguments before making your own.");
    }

    if (escalationPrompt) {
      systemParts.push(`- URGENT: ${escalationPrompt}`);
    }

    systemParts.push(`- ${phase}`);

    const system = systemParts.join("\n");

    let prompt: string;
    if (chatLog) {
      prompt = `Topic: ${topic}\n\nConversation:\n${chatLog}\n\n`;
      if (otherLastMsg) prompt += `They just said: ${otherLastMsg}\n\n`;
      prompt += "Your reply:";
    } else {
      prompt = `Topic: ${topic}\n\nSend your opening message:`;
    }

    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let attemptSystem = system;
      const temp = attempt === 0 ? 0.95 : 0.7 + attempt * 0.1;

      if (attempt > 0) {
        attemptSystem += `\n- CRITICAL: Your last response was too similar to something you already said. You MUST say something completely new and different. Change your argument, perspective, or approach entirely.`;
      }

      const text = await this.llmClient.generate(prompt, attemptSystem, {
        temperature: temp,
        max_tokens: 150,
      });

      if (!text?.trim()) continue;
      const candidate = text.trim();

      if (myPrev.length > 0) {
        const tooSimilar = myPrev.some((prev) => {
          const wordsA = new Set(candidate.toLowerCase().split(/\s+/));
          const wordsB = new Set(prev.toLowerCase().split(/\s+/));
          let overlap = 0;
          for (const w of wordsA) if (wordsB.has(w)) overlap++;
          const union = new Set([...wordsA, ...wordsB]).size;
          return union > 0 && overlap / union >= 0.85;
        });
        if (tooSimilar && attempt < maxAttempts - 1) continue;
      }

      const namePattern = new RegExp(`\\b${this.name.replace(/\s+/g, "\\s+")}\\b`, "gi");
      const nameCount = (candidate.match(namePattern) ?? []).length;
      if (nameCount > 2 && attempt < maxAttempts - 1) continue;

      const nameLower = this.name.toLowerCase();
      const candidateLower = candidate.toLowerCase();
      const thirdPersonHit = [" believes", " argues", " thinks", " said", " would say"].some(
        (suffix) => candidateLower.includes(nameLower + suffix),
      );
      if (thirdPersonHit && attempt < maxAttempts - 1) continue;

      return candidate;
    }
    throw new Error(`OpenAI returned repeated/empty responses for ${this.name} on topic "${topic}"`);
  }

  scoreRound(opts: {
    topic: string;
    roundNumber: number;
    maxRounds?: number;
    opponentObjective?: number;
    violatedRedLines?: number;
    lonCooperationRounds?: number;
    repeatedPositions?: number;
  }): number {
    const maxRounds = opts.maxRounds ?? 20;
    const opponentObjective = opts.opponentObjective ?? 0;

    const scores = scoreProposal(
      opts.topic,
      this.ideology,
      this.ocean.personalityModifier(),
      this.personality.cooperativeness,
    );

    scores.political.benefit *= this.personalityMultiplier;
    scores.economic.benefit *= this.personalityMultiplier;
    scores.social.benefit *= this.personalityMultiplier;

    this.fatigue = applyFatiguePenalty(
      this.fatigue,
      opts.roundNumber,
      this.personality.emotionalStability,
      maxRounds,
    );

    const penalty = computePenalty(
      opts.violatedRedLines ?? 0,
      opts.lonCooperationRounds ?? 0,
      opts.repeatedPositions ?? 0,
    );

    const rawObj = computeObjective(scores, this.regionWeights, this.fatigue, penalty);
    const adjusted = applyEmpathyMultiplier(rawObj, opponentObjective, this.empathyRatio);

    this.scorecard.roundsPlayed++;
    this.scorecard.roundScores.push(scores);
    this.scorecard.objectiveValues.push(adjusted);
    this.scorecard.fatigue = this.fatigue;
    this.scorecard.penalties += penalty;
    this.scorecard.empathyBonus += adjusted - rawObj;

    const cs = this.scorecard.cumulativeScores;
    cs.political.benefit = Math.min(100, cs.political.benefit + scores.political.benefit / maxRounds);
    cs.political.cost = Math.min(100, cs.political.cost + scores.political.cost / maxRounds);
    cs.economic.benefit = Math.min(100, cs.economic.benefit + scores.economic.benefit / maxRounds);
    cs.economic.cost = Math.min(100, cs.economic.cost + scores.economic.cost / maxRounds);
    cs.social.benefit = Math.min(100, cs.social.benefit + scores.social.benefit / maxRounds);
    cs.social.cost = Math.min(100, cs.social.cost + scores.social.cost / maxRounds);

    return adjusted;
  }

  calculateConsensusScore(other: HistoricalAgent): number {
    const ideologyCompat = IDEOLOGY_MATRIX[this.ideology]?.[other.ideology] ?? 0.5;

    const assertDiff = Math.abs(this.personality.assertiveness - other.personality.assertiveness);
    const coopDiff = Math.abs(this.personality.cooperativeness - other.personality.cooperativeness);
    const openDiff = Math.abs(this.personality.opennessToChange - other.personality.opennessToChange);
    const personalityCompat = 1.0 - (assertDiff + coopDiff + openDiff) / 3;

    const timeCompat = this.context.timePeriod === other.context.timePeriod ? 1.0 : 0.5;
    const cultureCompat = this.context.culturalBackground === other.context.culturalBackground ? 1.0 : 0.3;
    const sharedEvents = this.context.majorEvents.filter((e) => other.context.majorEvents.includes(e));
    const eventCompat =
      sharedEvents.length /
      Math.max(this.context.majorEvents.length, other.context.majorEvents.length, 1);
    const contextCompat = (timeCompat + cultureCompat + eventCompat) / 3;

    const consensus = ideologyCompat * 0.4 + personalityCompat * 0.3 + contextCompat * 0.3;
    return Math.max(0, Math.min(1, consensus));
  }

  willingnessToCompromise(): number {
    const positive =
      this.personality.cooperativeness * 0.35 +
      this.personality.opennessToChange * 0.25 +
      this.personality.pragmatism * 0.25 +
      this.personality.emotionalStability * 0.15;
    const negative = this.personality.assertiveness * 0.2 + this.personality.dominance * 0.2;
    return Math.max(0, Math.min(1, positive - negative * 0.5));
  }

  async evaluateProposalGenerically(proposal: string, proposer: HistoricalAgent): Promise<ProposalEvaluation> {
    const text = proposal.toLowerCase();
    let violatedRedLine: string | null = null;
    for (const red of this.redLines) {
      if (text.includes(red.toLowerCase())) {
        violatedRedLine = red;
        break;
      }
    }
    const ideological = this.calculateConsensusScore(proposer);
    const willingness = this.willingnessToCompromise();
    const blended = ideological * 0.5 + willingness * 0.5;

    let accept: boolean;
    if (violatedRedLine) {
      accept = false;
    } else {
      accept = blended >= 0.45;
    }

    if (this.llmClient) {
      const system = [
        `You are ${this.name}, ideology: ${this.ideology}.`,
        `Non-negotiable limits: ${this.redLines.join("; ") || "none"}.`,
        `Respond with ONLY a JSON object, no markdown, no explanation.`,
      ].join("\n");

      const prompt = [
        `${proposer.name} proposes: "${proposal}"`,
        `Your decision: ${accept ? "ACCEPT" : "REJECT"}.`,
        violatedRedLine ? `This violates your red line: "${violatedRedLine}".` : "",
        `Compatibility score: ${(blended * 100).toFixed(0)}%.`,
        `Respond as ${this.name} would. Give reasoning (1-2 sentences) and a counter-proposal (1 sentence).`,
        `Reply ONLY: {"reasoning": "...", "counter_proposal": "..."}`,
      ].filter(Boolean).join("\n");

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const raw = await this.llmClient.generate(prompt, system, {
            temperature: attempt === 0 ? 0.7 : 0.3,
            max_tokens: 200,
          });
          if (raw?.trim()) {
            const cleaned = raw.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "");
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.reasoning && parsed.counter_proposal) {
                return { accept, reasoning: parsed.reasoning, counter_proposal: parsed.counter_proposal };
              }
            }
            return {
              accept,
              reasoning: raw.trim().slice(0, 200),
              counter_proposal: accept ? "I accept with conditions." : "I propose an alternative approach.",
            };
          }
        } catch {
          // retry once
        }
      }
      return {
        accept,
        reasoning: accept
          ? `As ${this.name}, I find this proposal acceptable given ${(blended * 100).toFixed(0)}% compatibility.`
          : violatedRedLine
            ? `This violates my non-negotiable position on: ${violatedRedLine}.`
            : `As ${this.name}, I reject this due to ideological incompatibility.`,
        counter_proposal: accept ? "I accept with conditions." : "I propose an alternative approach.",
      };
    }

    return {
      accept,
      reasoning: accept
        ? `Compatible at ${(blended * 100).toFixed(0)}%.`
        : violatedRedLine
          ? `Violates red line: ${violatedRedLine}.`
          : `Ideologically incompatible.`,
      counter_proposal: accept ? "Accepted with conditions." : "Alternative approach needed.",
    };
  }

  injectEmpathy(boost: number): void {
    this.empathyRatio = Math.min(1, this.empathyRatio + boost);
    this.ocean.agreeableness = Math.min(1, this.ocean.agreeableness + boost * 0.5);
  }
}

