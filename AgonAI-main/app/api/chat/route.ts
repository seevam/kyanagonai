import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const XAI_BASE_URL = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";
const XAI_API_KEY = process.env.XAI_API_KEY ?? "";
const CACHE_TTL_S = parseInt(process.env.CHAT_CACHE_TTL_S ?? "120", 10);
const CACHE_MAX_ITEMS = parseInt(process.env.CHAT_CACHE_MAX_ITEMS ?? "256", 10);

const cache = new Map<string, { ts: number; value: Record<string, unknown> }>();

function cacheKey(payload: unknown): string {
  const raw = JSON.stringify(payload, Object.keys(payload as object).sort());
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function cacheGet(key: string): Record<string, unknown> | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() / 1000 - entry.ts > CACHE_TTL_S) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: Record<string, unknown>): void {
  if (cache.size >= CACHE_MAX_ITEMS) {
    let oldestKey = "";
    let oldestTs = Infinity;
    for (const [k, v] of cache) {
      if (v.ts < oldestTs) {
        oldestTs = v.ts;
        oldestKey = k;
      }
    }
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { ts: Date.now() / 1000, value });
}

interface ChatMessage {
  role: string;
  content: string;
}

function toXAIMessages(
  messages: { role?: string; content?: string }[],
): ChatMessage[] {
  const result: ChatMessage[] = [];
  for (const m of messages) {
    const text = m.content ?? "";
    if (!text) continue;
    const role = (m.role ?? "user").toLowerCase();
    let xaiRole: string;
    if (role === "assistant" || role === "model") xaiRole = "assistant";
    else if (role === "system") xaiRole = "system";
    else xaiRole = "user";
    result.push({ role: xaiRole, content: text });
  }
  return result;
}

function extractMessages(
  body: Record<string, unknown>,
): { role: string; content: string }[] {
  const messages = body.messages;
  if (Array.isArray(messages) && messages.length) {
    return messages
      .filter((m): m is Record<string, unknown> => typeof m === "object" && m !== null)
      .map((m) => ({
        role: String(m.role ?? "user"),
        content: m.content == null ? "" : String(m.content),
      }));
  }
  const prompt = (body.prompt ?? body.message) as string | undefined;
  if (prompt) return [{ role: "user", content: String(prompt) }];
  return [];
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": process.env.CHAT_CORS_ORIGIN ?? "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  return NextResponse.json(
    { status: "ok", service: "chat", api: "xai", has_api_key: !!XAI_API_KEY },
    { headers: corsHeaders() },
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!XAI_API_KEY) {
      return NextResponse.json(
        { error: "XAI_API_KEY is not configured" },
        { status: 500, headers: corsHeaders() },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const messages = extractMessages(body);
    if (!messages.length) {
      return NextResponse.json(
        { error: "messages or prompt is required" },
        { status: 400, headers: corsHeaders() },
      );
    }

    const model =
      (typeof body.model === "string" ? body.model : null) ??
      process.env.XAI_MODEL ??
      "grok-3-mini";

    const temperature = typeof body.temperature === "number" ? body.temperature : 0.2;
    const maxTokens = typeof body.max_tokens === "number" ? body.max_tokens : 512;

    const payload = {
      model,
      messages: toXAIMessages(messages),
      temperature,
      max_tokens: maxTokens,
    };

    const key = cacheKey(payload);
    const cached = cacheGet(key);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true }, { headers: corsHeaders() });
    }

    const resp = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        { error: "xAI API error", detail: text },
        { status: resp.status, headers: corsHeaders() },
      );
    }

    const data = await resp.json();
    let reply = "";
    const choices = data.choices;
    if (Array.isArray(choices) && choices.length && choices[0].message) {
      reply = choices[0].message.content ?? "";
    }

    const result = { reply, model };
    cacheSet(key, result);
    return NextResponse.json(result, { headers: corsHeaders() });
  } catch (err) {
    return NextResponse.json(
      { error: "Unhandled server error", detail: String(err) },
      { status: 500, headers: corsHeaders() },
    );
  }
}
