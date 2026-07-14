/**
 * Agent creation registry — maps string keys to agent constructors.
 */

import type { HistoricalAgent, LLMClient, MemoryClient } from "./base-agent";
import { HitlerAgent } from "./hitler-agent";
import { GandhiAgent } from "./gandhi-agent";
import { JinnahAgent } from "./jinnah-agent";
import { RationalAgent, EmpatheticAgent } from "./baseline-agents";

const AGENT_MAP: Record<
  string,
  (opts: { llmClient?: LLMClient | null; memoryClient?: MemoryClient | null }) => HistoricalAgent
> = {
  hitler: (opts) => new HitlerAgent(opts),
  gandhi: (opts) => new GandhiAgent(opts),
  jinnah: (opts) => new JinnahAgent(opts),
  rational: (opts) => new RationalAgent(opts),
  empathetic: (opts) => new EmpatheticAgent(opts),
};

export function createAgent(
  name: string,
  opts?: { llmClient?: LLMClient | null; memoryClient?: MemoryClient | null },
): HistoricalAgent {
  const key = name.toLowerCase();
  const factory = AGENT_MAP[key];
  if (!factory) {
    throw new Error(`Unknown agent: ${name}. Available: ${Object.keys(AGENT_MAP).join(", ")}`);
  }
  return factory(opts ?? {});
}

export const AVAILABLE_AGENTS = Object.keys(AGENT_MAP);
