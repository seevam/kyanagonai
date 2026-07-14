/**
 * Conversation state management for multi-turn chat continuity.
 */

import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

export interface ConversationTurn {
  role: string;
  content: string;
  ts: string; // ISO timestamp
}

export interface ConversationMetrics {
  rapport: number;
  polarity: number;
  topicPressure: number;
  empathyReservoir: number;
  consensusScore: number;
}

export interface ResponsePlan {
  replyType: string;
  rationale: string;
  repeatDetected: boolean;
}

// ---------------------------------------------------------------------------
// Cue lists
// ---------------------------------------------------------------------------

const ACKNOWLEDGEMENT_CUES = ["i hear you", "i understand", "that makes sense", "thanks for", "appreciate"];
const AGREEMENT_CUES = ["agree", "aligned", "makes sense", "sounds good", "yes"];
const DISAGREEMENT_CUES = ["disagree", "not aligned", "no", "doesn't", "cannot", "won't"];
const EMPATHY_CUES = ["you mentioned", "as you said", "earlier you", "i remember", "given your", "i hear you", "i appreciate"];
const CONFIRMATION_CUES = ["that's right", "correct", "exactly", "yes", "confirmed"];

function containsAny(text: string, cues: string[]): boolean {
  return cues.some((cue) => text.includes(cue));
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function splitSentences(text: string): string[] {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isSalient(sentence: string): boolean {
  const lowered = sentence.toLowerCase();
  return ["prefer", "priority", "goal", "need", "must", "should", "important", "want"].some(
    (cue) => lowered.includes(cue),
  );
}

function isOpenLoop(sentence: string): boolean {
  const lowered = sentence.toLowerCase();
  return (
    sentence.includes("?") ||
    ["todo", "next step", "follow up", "open"].some((cue) => lowered.includes(cue))
  );
}

function dedupeKeepOrder(items: string[], limit: number): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    output.push(item);
    if (output.length >= limit) break;
  }
  return output;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3).trimEnd() + "...";
}

function sequenceRatio(a: string, b: string): number {
  // Simple Levenshtein-based similarity
  const la = a.length;
  const lb = b.length;
  if (la === 0 && lb === 0) return 1;
  if (la === 0 || lb === 0) return 0;

  // Use character overlap as fast approximation
  const setA = new Set(a.split(""));
  const setB = new Set(b.split(""));
  let intersection = 0;
  for (const ch of setA) if (setB.has(ch)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  const charSimilarity = union > 0 ? intersection / union : 0;

  // Word overlap
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  let wordIntersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) wordIntersection++;
  const wordUnion = new Set([...wordsA, ...wordsB]).size;
  const wordSimilarity = wordUnion > 0 ? wordIntersection / wordUnion : 0;

  return charSimilarity * 0.3 + wordSimilarity * 0.7;
}

// ---------------------------------------------------------------------------
// ConversationState
// ---------------------------------------------------------------------------

export class ConversationState {
  sessionId: string;
  turns: ConversationTurn[] = [];
  summary = "";
  salience: string[] = [];
  openLoops: string[] = [];
  metrics: ConversationMetrics = {
    rapport: 0.5,
    polarity: 0.5,
    topicPressure: 0,
    empathyReservoir: 0,
    consensusScore: 0,
  };
  memoryWindow: number;
  compromiseThreshold: number;
  weights: Record<string, number>;
  willingnessToCompromise: number;
  private memoryBias = 0;

  constructor(opts?: {
    sessionId?: string;
    memoryWindow?: number;
    compromiseThreshold?: number;
    weights?: Record<string, number>;
    willingnessToCompromise?: number;
  }) {
    this.sessionId = opts?.sessionId ?? `session-${uuidv4().slice(0, 8)}`;
    this.memoryWindow = opts?.memoryWindow ?? 8;
    this.compromiseThreshold = opts?.compromiseThreshold ?? 0.7;
    this.weights = opts?.weights ?? {
      alignment: 0.35,
      willingness: 0.25,
      memory_bias: 0.2,
      empathy: 0.2,
    };
    this.willingnessToCompromise = opts?.willingnessToCompromise ?? 0.7;
  }

  appendTurn(role: string, content: string, ts?: string): void {
    this.turns.push({
      role,
      content,
      ts: ts ?? new Date().toISOString(),
    });
  }

  updateSummary(): string {
    if (this.turns.length <= this.memoryWindow) return this.summary;
    const olderTurns = this.turns.slice(0, -this.memoryWindow);
    const bits = olderTurns.slice(-6).map((t) => `${t.role}: ${truncate(t.content, 90)}`);
    this.summary = "Earlier context: " + bits.join(" | ");
    return this.summary;
  }

  extractSalienceAndOpenLoops(): void {
    const salience: string[] = [];
    const openLoops: string[] = [];
    for (const turn of this.turns.slice(-this.memoryWindow)) {
      for (const sentence of splitSentences(turn.content)) {
        if (isSalient(sentence)) salience.push(sentence);
        if (isOpenLoop(sentence)) openLoops.push(sentence);
      }
    }
    this.salience = dedupeKeepOrder(salience, 6);
    this.openLoops = dedupeKeepOrder(openLoops, 6);
  }

  updateMetrics(): void {
    if (!this.turns.length) return;
    const text = this.turns[this.turns.length - 1].content.toLowerCase();

    const acknowledgement = containsAny(text, ACKNOWLEDGEMENT_CUES);
    const agreement = containsAny(text, AGREEMENT_CUES);
    const disagreement = containsAny(text, DISAGREEMENT_CUES);
    const empathy = containsAny(text, EMPATHY_CUES);
    const confirmation = containsAny(text, CONFIRMATION_CUES);

    if (acknowledgement) this.metrics.rapport = clamp(this.metrics.rapport + 0.08);
    if (agreement) this.metrics.polarity = clamp(this.metrics.polarity + 0.1);
    if (disagreement) this.metrics.polarity = clamp(this.metrics.polarity - 0.15);
    if (empathy) this.metrics.empathyReservoir = clamp(this.metrics.empathyReservoir + 0.1);
    if (acknowledgement && empathy)
      this.metrics.empathyReservoir = clamp(this.metrics.empathyReservoir + 0.05);
    if (confirmation) this.memoryBias = clamp(this.memoryBias + 0.1);

    if (disagreement) this.metrics.topicPressure = clamp(this.metrics.topicPressure + 0.2);
    if (agreement || acknowledgement)
      this.metrics.topicPressure = clamp(this.metrics.topicPressure - 0.06);

    const alignment = this.metrics.polarity;
    const consensus =
      alignment * this.weights.alignment +
      this.willingnessToCompromise * this.weights.willingness +
      this.memoryBias * this.weights.memory_bias +
      this.metrics.empathyReservoir * this.weights.empathy;
    this.metrics.consensusScore = clamp(consensus);
  }

  lastTurns(count?: number): ConversationTurn[] {
    return this.turns.slice(-(count ?? this.memoryWindow));
  }

  lastTurnByRole(role: string): ConversationTurn | undefined {
    for (let i = this.turns.length - 1; i >= 0; i--) {
      if (this.turns[i].role === role) return this.turns[i];
    }
    return undefined;
  }

  isRepetitive(candidate: string, role?: string, threshold = 0.9): boolean {
    const lastTurn = role
      ? this.lastTurnByRole(role)
      : this.turns.length
        ? this.turns[this.turns.length - 1]
        : undefined;
    if (!lastTurn) return false;
    return sequenceRatio(lastTurn.content.toLowerCase(), candidate.toLowerCase()) >= threshold;
  }

  buildPromptContext(): Record<string, unknown> {
    const recent = this.lastTurns().map((t) => ({
      role: t.role,
      content: t.content,
      ts: t.ts,
    }));
    return {
      summary: this.summary,
      recent_turns: recent,
      salience: this.salience,
      open_loops: this.openLoops,
      metrics: {
        rapport: this.metrics.rapport,
        polarity: this.metrics.polarity,
        topic_pressure: this.metrics.topicPressure,
        empathy_reservoir: this.metrics.empathyReservoir,
        consensus_score: this.metrics.consensusScore,
      },
      memory_window: this.memoryWindow,
      compromise_threshold: this.compromiseThreshold,
    };
  }
}

// ---------------------------------------------------------------------------
// Conversation store
// ---------------------------------------------------------------------------

export class InMemoryConversationStore {
  private sessions = new Map<string, ConversationState>();

  loadState(sessionId: string): ConversationState {
    let state = this.sessions.get(sessionId);
    if (!state) {
      state = new ConversationState({ sessionId });
      this.sessions.set(sessionId, state);
    }
    return state;
  }
}

export function loadState(
  sessionId?: string | null,
  store?: InMemoryConversationStore,
): ConversationState {
  const s = store ?? new InMemoryConversationStore();
  const id = sessionId || `session-${uuidv4().slice(0, 8)}`;
  return s.loadState(id);
}

// ---------------------------------------------------------------------------
// Response planning
// ---------------------------------------------------------------------------

export function planResponse(
  state: ConversationState,
  lastUserMessage?: string | null,
): ResponsePlan {
  let repeatDetected = false;
  if (lastUserMessage) {
    const lastUser = state.lastTurnByRole("user");
    if (lastUser) {
      repeatDetected =
        sequenceRatio(lastUser.content.toLowerCase(), lastUserMessage.toLowerCase()) >= 0.92;
    }
  }

  const metrics = state.metrics;
  if (metrics.consensusScore >= state.compromiseThreshold) {
    return {
      replyType: "confirm_agreement",
      rationale: "Consensus score exceeds threshold; propose shared agreement and confirm.",
      repeatDetected,
    };
  }
  if (metrics.topicPressure >= 0.65 || metrics.polarity <= 0.35) {
    return {
      replyType: "summarize_and_choose",
      rationale: "Friction detected; summarize disagreement and offer options.",
      repeatDetected,
    };
  }
  if (state.openLoops.length) {
    return {
      replyType: "propose_plan",
      rationale: "Open loops exist; propose a concrete plan to resolve them.",
      repeatDetected,
    };
  }
  if (lastUserMessage && lastUserMessage.includes("?")) {
    return {
      replyType: "answer",
      rationale: "Direct question detected; answer and advance the thread.",
      repeatDetected,
    };
  }
  return {
    replyType: "propose_plan",
    rationale: "Default to advancing with a plan toward consensus.",
    repeatDetected,
  };
}
