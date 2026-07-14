/**
 * LLM client for local Ollama models.
 */

import type { GenerateOptions } from "./openai-client";

export class OllamaClient {
  private baseUrl: string;
  private model: string;
  private timeoutMs: number;

  constructor(opts?: { baseUrl?: string; model?: string; timeoutMs?: number }) {
    this.baseUrl = (
      opts?.baseUrl ||
      process.env.OLLAMA_BASE_URL ||
      "http://localhost:11434"
    ).replace(/\/+$/, "");
    this.model = opts?.model || process.env.OLLAMA_MODEL || "llama3.1:8b";
    this.timeoutMs = opts?.timeoutMs ?? 60000;
  }

  async generate(
    prompt: string,
    system?: string,
    options?: GenerateOptions,
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      model: this.model,
      prompt,
      stream: false,
    };
    if (system) payload.system = system;
    if (options) payload.options = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const resp = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      resp.ok || (() => { throw new Error(`Ollama error ${resp.status}`); })();
      const data = await resp.json();
      return (data.response as string) ?? "";
    } finally {
      clearTimeout(timer);
    }
  }
}
