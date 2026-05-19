/**
 * LLM client that uses the xAI (Grok) API for generating agent responses.
 */

export interface GenerateOptions {
  temperature?: number;
  max_tokens?: number;
}

export class XAIClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(opts?: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    timeoutMs?: number;
  }) {
    this.apiKey = opts?.apiKey || process.env.XAI_API_KEY || "";
    this.model = opts?.model || process.env.XAI_MODEL || "grok-3-mini";
    this.baseUrl = (
      opts?.baseUrl ||
      process.env.XAI_BASE_URL ||
      "https://api.x.ai/v1"
    ).replace(/\/+$/, "");
    this.timeoutMs = opts?.timeoutMs ?? 30000;
  }

  async generate(
    prompt: string,
    system?: string,
    options?: GenerateOptions,
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error("XAI_API_KEY is not set");
    }

    const messages: { role: string; content: string }[] = [];
    if (system) {
      messages.push({ role: "system", content: system });
    }
    messages.push({ role: "user", content: prompt });

    const temperature = options?.temperature ?? 0.9;
    const maxTokens = options?.max_tokens ?? 256;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const resp = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`xAI API error ${resp.status}: ${text}`);
      }

      const data = await resp.json();
      const choices = data.choices ?? [];
      if (choices.length && choices[0].message) {
        return choices[0].message.content ?? "";
      }
      return "";
    } finally {
      clearTimeout(timer);
    }
  }

  getModel(): string {
    return this.model;
  }
}
