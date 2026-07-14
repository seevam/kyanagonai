export interface GenerateOptions {
  temperature?: number;
  max_tokens?: number;
}

export class OpenAIClient {
  private apiKey: string;
  private model: string;
  private timeoutMs: number;

  constructor(opts?: { apiKey?: string; model?: string; timeoutMs?: number }) {
    this.apiKey = opts?.apiKey || process.env.OPENAI_API_KEY || "";
    this.model = opts?.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
    this.timeoutMs = opts?.timeoutMs ?? 30000;
  }

  async generate(prompt: string, system?: string, options?: GenerateOptions): Promise<string> {
    if (!this.apiKey) throw new Error("OPENAI_API_KEY is not set");

    const messages: { role: string; content: string }[] = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options?.temperature ?? 0.9,
          max_tokens: options?.max_tokens ?? 256,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`OpenAI API error ${resp.status}: ${text}`);
      }

      const data = await resp.json();
      return data.choices?.[0]?.message?.content ?? "";
    } finally {
      clearTimeout(timer);
    }
  }

  getModel(): string { return this.model; }
}
