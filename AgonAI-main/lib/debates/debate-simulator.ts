/**
 * Debate simulation system for historical figure AI agents.
 */

import type { HistoricalAgent } from "../agents/base-agent";
import { ConversationState, planResponse } from "../utils/conversation-state";

export enum DebateStatus {
  ACTIVE = "active",
  PAUSED = "paused",
  CONCLUDED = "concluded",
  CONSENSUS_REACHED = "consensus_reached",
  DEADLOCK = "deadlock",
}

export interface DebateRound {
  roundNumber: number;
  speaker: string;
  topic: string;
  response: string;
  timestamp: string;
  context: Record<string, unknown>;
}

export interface DebateResult {
  status: DebateStatus;
  rounds: DebateRound[];
  consensusScore: number;
  keyAgreements: string[];
  keyDisagreements: string[];
  finalPositions: Record<string, Record<string, string>>;
  durationMinutes: number;
  majorityVote: Record<string, unknown>;
  finalResolution: Record<string, unknown> | null;
  policyScorecards?: Record<string, Record<string, unknown>>;
}

export class DebateSimulator {
  maxRounds: number;
  consensusThreshold: number;
  memoryWindow: number;
  debateHistory: DebateRound[] = [];
  conversationState: ConversationState | null = null;

  constructor(opts?: {
    maxRounds?: number;
    consensusThreshold?: number;
    memoryWindow?: number;
  }) {
    this.maxRounds = opts?.maxRounds ?? 20;
    this.consensusThreshold = opts?.consensusThreshold ?? 0.8;
    this.memoryWindow = opts?.memoryWindow ?? 8;
  }

  async debate(
    agents: HistoricalAgent[],
    topic: string,
    initialContext?: Record<string, unknown>,
    onRound?: (round: DebateRound) => void | Promise<void>,
    onThinking?: (speaker: string, roundNumber: number) => void | Promise<void>,
  ): Promise<DebateResult> {
    if (agents.length < 2) throw new Error("At least 2 agents are required");

    const startTime = Date.now();
    this.debateHistory = [];
    const currentContext: Record<string, unknown> = { ...(initialContext ?? {}) };
    this.conversationState =
      (currentContext.conversation_state as ConversationState) ?? null;

    // Initialize positions
    for (const agent of agents) {
      agent.currentPosition = { ...agent.currentPosition };
    }

    // Conversation state init
    if (this.conversationState && !this.conversationState.turns.length) {
      this.conversationState.appendTurn("system", `Debate topic: ${topic}`);
      this.conversationState.updateSummary();
      this.conversationState.extractSalienceAndOpenLoops();
      this.conversationState.updateMetrics();
    }

    for (let roundNum = 0; roundNum < this.maxRounds; roundNum++) {
      const currentSpeaker = agents[roundNum % agents.length];

      if (this.conversationState) {
        currentContext.conversation_context =
          this.conversationState.buildPromptContext();
        const plan = planResponse(this.conversationState, null);
        currentContext.response_plan = {
          replyType: plan.replyType,
          rationale: plan.rationale,
          repeatDetected: plan.repeatDetected,
        };
        currentContext.conversation_state = this.conversationState;
      }

      currentContext.memory_summary = currentSpeaker.getMemorySummary();
      currentContext.shared_memory = this.getSharedMemorySummary();

      // Notify that this speaker is about to generate
      if (onThinking) await onThinking(currentSpeaker.name, roundNum + 1);

      // Generate response
      const response = await currentSpeaker.generateResponse(
        topic,
        agents.filter((a) => a.name !== currentSpeaker.name),
        currentContext,
      );

      currentSpeaker.updatePosition({ [topic]: response });

      // Record the round
      const roundData: DebateRound = {
        roundNumber: roundNum + 1,
        speaker: currentSpeaker.name,
        topic,
        response,
        timestamp: new Date().toISOString(),
        context: { ...currentContext },
      };
      this.debateHistory.push(roundData);

      // Notify listener
      if (onRound) await onRound(roundData);

      // Add to history
      for (const agent of agents) {
        agent.addToHistory(currentSpeaker.name, response, currentContext);
      }
      if (this.conversationState) {
        this.conversationState.appendTurn(currentSpeaker.name, response);
        this.conversationState.updateSummary();
        this.conversationState.extractSalienceAndOpenLoops();
        this.conversationState.updateMetrics();
      }

      // Check consensus
      const consensusScore = this.calculateConsensusScore(agents);
      if (consensusScore >= this.consensusThreshold) {
        const duration = (Date.now() - startTime) / 60000;
        return await this.createResult(
          DebateStatus.CONSENSUS_REACHED,
          agents,
          consensusScore,
          duration,
        );
      }

      // Check deadlock
      if (this.isDeadlock()) {
        const duration = (Date.now() - startTime) / 60000;
        return await this.createResult(DebateStatus.DEADLOCK, agents, consensusScore, duration);
      }

      currentContext[`round_${roundNum + 1}_response`] = response;
      currentContext[`round_${roundNum + 1}_speaker`] = currentSpeaker.name;
    }

    const duration = (Date.now() - startTime) / 60000;
    const finalConsensus = this.calculateConsensusScore(agents);
    return await this.createResult(DebateStatus.CONCLUDED, agents, finalConsensus, duration);
  }

  private calculateConsensusScore(agents: HistoricalAgent[]): number {
    if (agents.length < 2) return 1.0;
    let totalScore = 0;
    let pairCount = 0;
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        totalScore += agents[i].calculateConsensusScore(agents[j]);
        pairCount++;
      }
    }
    return pairCount > 0 ? totalScore / pairCount : 0;
  }

  private isDeadlock(lookbackRounds = 6): boolean {
    if (this.debateHistory.length < lookbackRounds) return false;
    const recent = this.debateHistory.slice(-lookbackRounds).map((r) => r.response);

    // Count distinct responses using fuzzy matching (word overlap)
    const distinct: string[] = [];
    for (const resp of recent) {
      const wordsA = new Set(resp.toLowerCase().split(/\s+/));
      const isDuplicate = distinct.some((existing) => {
        const wordsB = new Set(existing.toLowerCase().split(/\s+/));
        let overlap = 0;
        for (const w of wordsA) if (wordsB.has(w)) overlap++;
        const union = new Set([...wordsA, ...wordsB]).size;
        return union > 0 && overlap / union >= 0.5;
      });
      if (!isDuplicate) distinct.push(resp);
    }
    return distinct.length <= 2;
  }

  private async createResult(
    status: DebateStatus,
    agents: HistoricalAgent[],
    consensusScore: number,
    duration: number,
  ): Promise<DebateResult> {
    const { agreements, disagreements } = this.analyzePositions(agents);
    const finalPositions: Record<string, Record<string, string>> = {};
    for (const agent of agents) finalPositions[agent.name] = agent.currentPosition;

    const { majorityVote, finalResolution } = await this.conductMajorityVote(agents);

    const policyScorecards: Record<string, Record<string, unknown>> = {};
    for (const agent of agents) {
      if (agent.scorecard.roundsPlayed > 0) {
        policyScorecards[agent.name] = agent.scorecard.asDict();
      }
    }

    return {
      status,
      rounds: [...this.debateHistory],
      consensusScore,
      keyAgreements: agreements,
      keyDisagreements: disagreements,
      finalPositions,
      durationMinutes: duration,
      majorityVote,
      finalResolution,
      policyScorecards: Object.keys(policyScorecards).length ? policyScorecards : undefined,
    };
  }

  private getSharedMemorySummary(): string {
    const recent = this.debateHistory.slice(-this.memoryWindow);
    if (!recent.length) return "No shared memory yet.";
    return recent
      .map((r) => {
        let snippet = r.response.replace(/\n/g, " ").trim();
        if (snippet.length > 120) snippet = snippet.slice(0, 117).trimEnd() + "...";
        return `- ${r.speaker}: ${snippet}`;
      })
      .join("\n");
  }

  private async conductMajorityVote(agents: HistoricalAgent[]): Promise<{
    majorityVote: Record<string, unknown>;
    finalResolution: Record<string, unknown> | null;
  }> {
    const proposals: { proposer: string; topic: string; proposal: string }[] = [];
    for (const agent of agents) {
      for (const [topic, position] of Object.entries(agent.currentPosition)) {
        proposals.push({ proposer: agent.name, topic, proposal: position });
      }
    }

    if (!proposals.length) {
      return {
        majorityVote: { proposals: [], majorityNeeded: Math.floor(agents.length / 2) + 1 },
        finalResolution: null,
      };
    }

    const majorityNeeded = Math.floor(agents.length / 2) + 1;
    const voteResults: Record<string, unknown>[] = [];
    const accepted: typeof proposals = [];

    const agentMap = new Map(agents.map((a) => [a.name, a]));
    // Evaluate all proposals in parallel (each proposal's voters also run in parallel)
    const outcomePromises = proposals.map(async (proposal) => {
      const proposer = agentMap.get(proposal.proposer)!;
      const evaluations = await Promise.all(
        agents.map(async (agent) => {
          const evaluation = await agent.evaluateProposal(proposal.proposal, proposer);
          return { voter: agent.name, accept: evaluation.accept, reasoning: evaluation.reasoning };
        }),
      );
      const acceptCount = evaluations.filter((e) => e.accept).length;
      return {
        proposal,
        acceptCount,
        votes: evaluations,
        passed: acceptCount >= majorityNeeded,
      };
    });
    const outcomes = await Promise.all(outcomePromises);
    for (const outcome of outcomes) {
      voteResults.push(outcome);
      if (outcome.passed) accepted.push(outcome.proposal);
    }

    return {
      majorityVote: {
        proposals: voteResults,
        majorityNeeded,
        acceptedCount: accepted.length,
      },
      finalResolution: accepted.length ? accepted[0] : null,
    };
  }

  private analyzePositions(agents: HistoricalAgent[]): {
    agreements: string[];
    disagreements: string[];
  } {
    const agreements: string[] = [];
    const disagreements: string[] = [];

    const commonTopics = new Set<string>();
    for (const agent of agents) {
      for (const key of Object.keys(agent.currentPosition)) commonTopics.add(key);
    }

    for (const topic of commonTopics) {
      const positions: [string, string][] = [];
      for (const agent of agents) {
        if (topic in agent.currentPosition) {
          positions.push([agent.name, agent.currentPosition[topic]]);
        }
      }
      if (positions.length >= 2) {
        if (this.positionsSimilar(positions)) {
          agreements.push(`Agreement on ${topic}: ${positions[0][1]}`);
        } else {
          const text = positions.map(([name, pos]) => `${name} (${pos})`).join("; ");
          disagreements.push(`Disagreement on ${topic}: ${text}`);
        }
      }
    }
    return { agreements, disagreements };
  }

  private positionsSimilar(positions: [string, string][], threshold = 0.7): boolean {
    if (positions.length < 2) return true;
    const words1 = new Set(positions[0][1].toLowerCase().split(/\s+/));
    const words2 = new Set(positions[1][1].toLowerCase().split(/\s+/));
    if (!words1.size || !words2.size) return false;
    let overlap = 0;
    for (const w of words1) if (words2.has(w)) overlap++;
    const union = new Set([...words1, ...words2]).size;
    return overlap / union >= threshold;
  }

  getDebateTranscript(): string {
    let transcript = "=== DEBATE TRANSCRIPT ===\n\n";
    for (const rd of this.debateHistory) {
      transcript += `Round ${rd.roundNumber} - ${rd.speaker}:\n${rd.response}\n\n`;
    }
    return transcript;
  }
}
