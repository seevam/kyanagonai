/**
 * Memory and context clients for debate simulations.
 */

interface MemoryEvent {
  speaker: string;
  content: string;
  metadata: Record<string, unknown>;
}

export class SuperMemoryClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private events: Map<string, MemoryEvent[]> = new Map();

  constructor(opts?: { apiKey?: string; baseUrl?: string; timeoutMs?: number }) {
    this.apiKey = opts?.apiKey || process.env.SUPERMEMORY_API_KEY || "";
    this.baseUrl = opts?.baseUrl || process.env.SUPERMEMORY_BASE_URL || "";
    this.timeoutMs = opts?.timeoutMs ?? 3000;
  }

  async recordEvent(
    agentName: string,
    speaker: string,
    content: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const list = this.events.get(agentName) ?? [];
    list.push({ speaker, content, metadata });
    this.events.set(agentName, list);

    if (!this.baseUrl) return;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      await fetch(`${this.baseUrl.replace(/\/+$/, "")}/memory`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agent: agentName, speaker, content, metadata }),
        signal: controller.signal,
      });
      clearTimeout(timer);
    } catch {
      // Silently ignore remote failures
    }
  }

  summarizeRecent(agentName: string, window = 8): string {
    const events = (this.events.get(agentName) ?? []).slice(-window);
    if (!events.length) return "No recent memory available.";
    return events
      .map((e) => {
        let snippet = e.content.replace(/\n/g, " ").trim();
        if (snippet.length > 140) snippet = snippet.slice(0, 137).trimEnd() + "...";
        return `- ${e.speaker}: ${snippet}`;
      })
      .join("\n");
  }
}

export class ExaContextClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(opts?: { apiKey?: string; baseUrl?: string; timeoutMs?: number }) {
    this.apiKey = opts?.apiKey || process.env.EXA_API_KEY || "";
    this.baseUrl = opts?.baseUrl || process.env.EXA_BASE_URL || "";
    this.timeoutMs = opts?.timeoutMs ?? 3000;
  }

  async fetchContext(query: string): Promise<string | null> {
    if (!this.baseUrl) return null;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const resp = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) return null;
      const data = await resp.json();
      return (data.summary as string) ?? null;
    } catch {
      return null;
    }
  }
}
