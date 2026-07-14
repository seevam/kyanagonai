"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const AGENT_COLORS: Record<string, string> = {
  "Adolf Hitler": "#e11d48",
  "Mahatma Gandhi": "#22c55e",
  "Muhammad Ali Jinnah": "#38bdf8",
  "Rational Agent": "#8b5cf6",
  "Rational-A": "#8b5cf6",
  "Rational-B": "#a78bfa",
  "Empathetic Agent": "#f59e0b",
  "Empathetic-A": "#f59e0b",
  "Empathetic-B": "#fbbf24",
  "Low-Empathy": "#ef4444",
  "High-Empathy": "#10b981",
  Rational: "#8b5cf6",
  Empathetic: "#f59e0b",
};

function getColor(name: string) {
  return AGENT_COLORS[name] || "#6366f1";
}

function bubbleStyle(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    bg: `rgba(${r}, ${g}, ${b}, 0.12)`,
    text: `rgb(${Math.round(r * 0.45)}, ${Math.round(g * 0.45)}, ${Math.round(b * 0.45)})`,
    border: `rgba(${r}, ${g}, ${b}, 0.25)`,
  };
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function roundTwo(val: number | null | undefined) {
  if (val == null) return "\u2014";
  return val.toFixed(2);
}

// ---- Download helper ----
function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface AgentProfile {
  name: string;
  origin: string;
  bio: string;
  tags: string[];
  avatarClass: string;
  initials: string;
  focusPrompt: string;
}

const AGENT_PROFILES: Record<string, AgentProfile> = {
  hitler: {
    name: "Adolf Hitler",
    origin: "Germany",
    bio: "Authoritarian nationalist persona with low cooperativeness and rigid red lines on territorial control.",
    tags: ["Dominance: High", "Cooperativeness: Low", "Ideology: Fascism"],
    avatarClass: "avatar-hitler",
    initials: "AH",
    focusPrompt: "Begin with a guarded, high-stakes negotiation framing about sovereignty.",
  },
  gandhi: {
    name: "Mahatma Gandhi",
    origin: "India",
    bio: "Nonviolent negotiator emphasizing moral appeals, empathy-weighted memory, and consensus building.",
    tags: ["Justice: High", "Cooperativeness: High", "Ideology: Nonviolence"],
    avatarClass: "avatar-gandhi",
    initials: "MG",
    focusPrompt: "Open with a compassion-forward dialogue on shared humanitarian goals.",
  },
  jinnah: {
    name: "Muhammad Ali Jinnah",
    origin: "Pakistan",
    bio: "Strategic constitutionalist balancing pragmatism with assertive negotiation over autonomy and rights.",
    tags: ["Assertiveness: High", "Pragmatism: Medium", "Ideology: Muslim Nationalism"],
    avatarClass: "avatar-jinnah",
    initials: "MJ",
    focusPrompt: "Frame a legalistic discussion about self-determination and governance safeguards.",
  },
};

interface ChatMsg {
  round: number;
  speaker: string;
  content: string;
}

function TypingText({ text, speed = 60, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let i = 0;
    doneRef.current = false;
    setDisplayed("");
    const timer = setInterval(() => {
      i++;
      const nextSpace = text.indexOf(" ", i);
      const chunkEnd = nextSpace === -1 ? text.length : nextSpace + 1;
      if (i >= text.length) {
        setDisplayed(text);
        clearInterval(timer);
        if (!doneRef.current) {
          doneRef.current = true;
          onDoneRef.current?.();
        }
      } else {
        setDisplayed(text.slice(0, chunkEnd));
        i = chunkEnd;
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return <>{displayed}<span className="typing-cursor">|</span></>;
}

function ChatBubble({
  msg,
  alignRight,
  delay,
  typing = false,
}: {
  msg: ChatMsg;
  alignRight: boolean;
  delay: number;
  typing?: boolean;
}) {
  const color = getColor(msg.speaker);
  const style = bubbleStyle(color);
  return (
    <div
      className="chat-bubble"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        alignSelf: alignRight ? "flex-end" : undefined,
        animationDelay: `${delay}s`,
      }}
    >
      <div className="chat-avatar" style={{ background: color }}>
        {initials(msg.speaker)}
      </div>
      <div className="chat-body">
        <div className="chat-speaker" style={{ color }}>
          {msg.speaker} <span className="chat-round">Round {msg.round}</span>
        </div>
        <div className="chat-text" style={{ color: style.text }}>
          {typing ? <TypingText text={msg.content} /> : msg.content}
        </div>
      </div>
    </div>
  );
}

function DimBar({ label, dim }: { label: string; dim: { benefit: number; cost: number; net: number } }) {
  const netClass = dim.net >= 0 ? "positive" : "negative";
  return (
    <div className="dim">
      <span className="dim-label">{label}</span>
      <span className="dim-bar">
        <span className="bar-benefit" style={{ width: `${Math.min(dim.benefit, 100)}%` }} />
        <span className="bar-cost" style={{ width: `${Math.min(dim.cost, 100)}%` }} />
      </span>
      <span className={`dim-net ${netClass}`}>
        {dim.net > 0 ? "+" : ""}
        {roundTwo(dim.net)}
      </span>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ScoreCards({ scores }: { scores: Record<string, any> }) {
  return (
    <div className="scores-grid">
      {Object.entries(scores).map(([name, card]) => {
        const color = getColor(name);
        const cs = card.cumulative_scores ?? {};
        return (
          <div className="score-card" key={name}>
            <h3 style={{ color }}>{name}</h3>
            <div className="score-dims">
              {cs.political && <DimBar label="Political" dim={cs.political} />}
              {cs.economic && <DimBar label="Economic" dim={cs.economic} />}
              {cs.social && <DimBar label="Social" dim={cs.social} />}
            </div>
            <div className="score-meta">
              <span>Objective: <b>{roundTwo(card.final_objective)}</b></span>
              <span>Fatigue: {roundTwo(card.fatigue)}</span>
              <span>Empathy bonus: {roundTwo(card.empathy_bonus)}</span>
              <span>Penalties: {roundTwo(card.penalties)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [selectedAgents, setSelectedAgents] = useState<Record<string, boolean>>({
    hitler: true, gandhi: true, jinnah: true, rational: false, empathetic: false,
  });
  const [topic, setTopic] = useState("");
  const [rounds, setRounds] = useState(12);
  const [summaryOnly, setSummaryOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);
  const [rawJson, setRawJson] = useState("");
  const [streamingMessages, setStreamingMessages] = useState<ChatMsg[]>([]);
  const [thinkingSpeaker, setThinkingSpeaker] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [expId, setExpId] = useState(1);
  const [expTopic, setExpTopic] = useState("war");
  const [expRounds, setExpRounds] = useState(15);
  const [expAgents, setExpAgents] = useState<Record<string, boolean>>({
    hitler: true, gandhi: true, jinnah: false,
  });
  const [expLoading, setExpLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [expResult, setExpResult] = useState<any>(null);

  const [activeProfile, setActiveProfile] = useState<string | null>(null);

  const configRef = useRef<HTMLDivElement>(null);
  const expRef = useRef<HTMLDivElement>(null);

  const profile = activeProfile ? AGENT_PROFILES[activeProfile] : null;

  const toggleAgent = useCallback((key: string) => {
    setValidationError("");
    setSelectedAgents((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const runDebate = async () => {
    const agents = Object.entries(selectedAgents)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (agents.length < 2) {
      setValidationError("Please select at least 2 agents to start a debate.");
      return;
    }
    if (!topic) {
      setValidationError("Please enter a debate topic.");
      return;
    }

    setValidationError("");
    setLoading(true);
    setResult(null);
    setRawJson("");
    setStreamingMessages([]);
    setThinkingSpeaker("");

    try {
      const sessionId = typeof window !== "undefined" ? localStorage.getItem("sessionId") : null;
      const resp = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents, topic, rounds, summaryOnly, sessionId, stream: true }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        setResult(err);
        setRawJson(JSON.stringify(err, null, 2));
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "thinking") {
              setThinkingSpeaker(event.speaker);
            } else if (event.type === "round") {
              setThinkingSpeaker("");
              const msg: ChatMsg = { round: event.round, speaker: event.speaker, content: event.content };
              setStreamingMessages((prev) => [...prev, msg]);
            } else if (event.type === "complete") {
              setThinkingSpeaker("");
              const data = { ...event };
              delete data.type;
              if (data.sessionId && typeof window !== "undefined") {
                localStorage.setItem("sessionId", data.sessionId);
              }
              setResult(data);
              setRawJson(JSON.stringify(data, null, 2));
            } else if (event.type === "error") {
              setResult({ error: event.error });
              setRawJson(JSON.stringify(event, null, 2));
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      setRawJson(String(err));
    } finally {
      setLoading(false);
    }
  };

  const runExperiment = async () => {
    const histAgents = Object.entries(expAgents)
      .filter(([, v]) => v)
      .map(([k]) => k);

    setExpLoading(true);
    setExpResult(null);

    try {
      const resp = await fetch("/api/experiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experimentId: expId,
          topic: expTopic,
          maxRounds: expRounds,
          historicalAgents: histAgents,
        }),
      });
      const data = await resp.json();
      setExpResult(data);
    } catch (err) {
      setExpResult({ error: String(err) });
    } finally {
      setExpLoading(false);
    }
  };

  const displayMessages = streamingMessages.length > 0 ? streamingMessages : (result?.chatMessages ?? []);
  const speakerOrder: string[] = [];
  for (const msg of displayMessages) {
    if (!speakerOrder.includes(msg.speaker)) speakerOrder.push(msg.speaker);
  }

  return (
    <div className="container">
      {/* Hero */}
      <header className="hero">
        <div className="hero-copy">
          <h1>AgonAI: Political Agent Consensus Lab</h1>
          <p>
            Explore empathy-weighted negotiations between historically adversarial personas.
            Hover over a chatbot on the world map to see their origin, role, and bio, then add
            them to a debate run.
          </p>
          <div className="hero-actions">
            <button className="secondary" onClick={() => configRef.current?.scrollIntoView({ behavior: "smooth" })}>
              Configure Debate
            </button>
            <button className="secondary" onClick={() => expRef.current?.scrollIntoView({ behavior: "smooth" })}>
              Run Experiments
            </button>
          </div>
        </div>

        <section className="map-panel" aria-label="World map with chatbot agents">
          <div className="map-stage">
            <svg className="world-map" viewBox="0 0 900 450" role="img" aria-label="Stylized world map">
              <path d="M67 146l70-34 51 16 22 36-16 44-52 20-58-16-17-36z" />
              <path d="M248 122l80-28 78 18 34 38-10 44-60 28-78-10-52-44z" />
              <path d="M408 188l68-22 76 12 46 40-8 36-70 30-72-12-36-34z" />
              <path d="M552 132l70-26 86 20 40 38-12 42-70 30-84-14-30-40z" />
              <path d="M610 244l96-28 76 10 46 40-18 46-88 30-72-12-40-36z" />
              <path d="M120 268l68-24 76 14 40 32-12 40-78 28-72-14-22-32z" />
            </svg>
            {[
              { key: "hitler", left: "47%", top: "35%" },
              { key: "gandhi", left: "63%", top: "46%" },
              { key: "jinnah", left: "66%", top: "42%" },
            ].map((m) => (
              <button
                key={m.key}
                className="agent-marker"
                style={{ left: m.left, top: m.top }}
                onMouseEnter={() => setActiveProfile(m.key)}
                onFocus={() => setActiveProfile(m.key)}
                onClick={() => {
                  setActiveProfile(m.key);
                  setSelectedAgents((prev) => ({ ...prev, [m.key]: true }));
                }}
              >
                <span className={`avatar ${AGENT_PROFILES[m.key].avatarClass}`}>
                  {AGENT_PROFILES[m.key].initials}
                </span>
              </button>
            ))}
            <div className="map-legend">
              <span className="legend-pill">Hover to zoom + view bio</span>
              <span className="legend-pill">Click to add to debate</span>
            </div>
          </div>

          <aside className="agent-profile">
            <div className="agent-header">
              <span className={`avatar ${profile?.avatarClass ?? ""}`} style={!profile ? { background: "#94a3b8" } : undefined}>
                {profile?.initials ?? "?"}
              </span>
              <div>
                <h3>{profile?.name ?? "Select an agent"}</h3>
                <p style={{ margin: 0 }}>Origin: {profile?.origin ?? "\u2014"}</p>
              </div>
            </div>
            <p>{profile?.bio ?? "Hover over a chatbot marker to view their background and negotiation persona."}</p>
            {profile && (
              <div className="profile-tags">
                {profile.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            )}
            <div className="profile-actions">
              <button
                disabled={!activeProfile}
                onClick={() => {
                  if (activeProfile) {
                    setSelectedAgents((prev) => ({ ...prev, [activeProfile]: true }));
                    configRef.current?.scrollIntoView({ behavior: "smooth" });
                  }
                }}
              >
                Add to Debate
              </button>
              <button
                className="secondary"
                disabled={!activeProfile}
                onClick={() => {
                  if (activeProfile && AGENT_PROFILES[activeProfile]) {
                    setTopic(AGENT_PROFILES[activeProfile].focusPrompt);
                    setSelectedAgents((prev) => ({ ...prev, [activeProfile]: true }));
                    configRef.current?.scrollIntoView({ behavior: "smooth" });
                  }
                }}
              >
                Focus Bio Chat
              </button>
            </div>
            <p className="profile-note">
              Use &quot;Focus Bio Chat&quot; to prefill the topic with a guided intro prompt.
            </p>
          </aside>
        </section>
      </header>

      {/* Configuration */}
      <section className="panel" ref={configRef}>
        <h2>Configuration</h2>
        <div className="form-row">
          <label>Agents:</label>
          <div className="agents">
            {["hitler", "gandhi", "jinnah", "rational", "empathetic"].map((a) => (
              <label key={a}>
                <input
                  type="checkbox"
                  checked={!!selectedAgents[a]}
                  onChange={() => toggleAgent(a)}
                />{" "}
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </label>
            ))}
          </div>
        </div>
        <div className="form-row">
          <label htmlFor="topic">Topic:</label>
          <input
            id="topic"
            type="text"
            placeholder="Type any topic, e.g. 'Should nations have open borders?'"
            value={topic}
            onChange={(e) => { setValidationError(""); setTopic(e.target.value); }}
            className="topic-input"
          />
        </div>
        <div className="form-row">
          <label htmlFor="rounds">Rounds:</label>
          <input
            id="rounds"
            type="number"
            min={3}
            max={30}
            value={rounds}
            onChange={(e) => setRounds(parseInt(e.target.value) || 12)}
          />
        </div>
        <div className="form-row">
          <label>
            <input type="checkbox" checked={summaryOnly} onChange={() => setSummaryOnly(!summaryOnly)} /> Summary only
          </label>
        </div>
        {validationError && (
          <div className="form-row">
            <div style={{ padding: "0.5rem 0.75rem", background: "#fef3c7", borderRadius: "6px", color: "#92400e", fontSize: "0.875rem" }}>
              {validationError}
            </div>
          </div>
        )}
        <div className="form-row">
          <button onClick={runDebate} disabled={loading}>
            {loading ? (
              <><span className="spinner" />Running...</>
            ) : (
              "Run Debate"
            )}
          </button>
        </div>
      </section>

      {/* Debate Error */}
      {result?.error && (
        <section className="panel">
          <div style={{ padding: "1rem", background: "#fee2e2", borderRadius: "8px", color: "#991b1b" }}>
            <strong>Debate failed:</strong> {result.detail || result.error}
          </div>
        </section>
      )}

      {/* Chat Results */}
      {(displayMessages.length > 0 || loading) && (
        <section className="panel">
          <h2>Debate Chat</h2>
          {result && !result.error && (
            <div className="chat-stats">
              <div className="stats-row">
                <span className={`stat-chip status-${result.status}`}>{result.status}</span>
                <span className="stat-chip">Consensus: {result.consensusScore}</span>
                <span className="stat-chip">Rounds: {result.rounds}</span>
                <span className="stat-chip">Duration: {result.durationMinutes}m</span>
                {result.empathyRatios &&
                  Object.entries(result.empathyRatios).map(([name, val]) => (
                    <span className="stat-chip" key={name}>
                      <b>{name}</b> empathy: {String(val)}
                    </span>
                  ))}
              </div>
            </div>
          )}
          <div className="chat-container">
            {displayMessages.map((msg: ChatMsg, i: number) => {
              const isLatest = i === displayMessages.length - 1 && loading && !result;
              return (
                <ChatBubble
                  key={`${msg.round}-${msg.speaker}-${i}`}
                  msg={msg}
                  alignRight={speakerOrder.indexOf(msg.speaker) % 2 === 1}
                  delay={0}
                  typing={isLatest}
                />
              );
            })}
            {loading && !result && (
              <div className="chat-thinking">
                <span className="spinner" />{" "}
                {thinkingSpeaker
                  ? <><span style={{ color: getColor(thinkingSpeaker), fontWeight: 600 }}>{thinkingSpeaker}</span> is thinking...</>
                  : "Starting debate..."}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </section>
      )}

      {/* Policy Scores */}
      {result?.policyScores && (
        <section className="panel">
          <h2>Policy Scores</h2>
          <ScoreCards scores={result.policyScores} />
        </section>
      )}

      {/* Experiments */}
      <section className="panel" ref={expRef}>
        <h2>Experiments</h2>
        <p className="help-text">Run pre-configured experiments to compare rational vs empathetic negotiation.</p>
        <div className="form-row">
          <label htmlFor="expSelect">Experiment:</label>
          <select id="expSelect" value={expId} onChange={(e) => setExpId(parseInt(e.target.value))}>
            <option value={1}>1. Rational vs Rational</option>
            <option value={2}>2. Empathetic vs Empathetic</option>
            <option value={3}>3. Rational vs Empathetic</option>
            <option value={4}>4. Low Empathy vs High Empathy</option>
            <option value={5}>5. Historical Conflict</option>
            <option value={6}>6. Historical + Empathy Injection</option>
            <option value={7}>7. Historical + Judge</option>
            <option value={8}>8. Full Pipeline</option>
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="expTopic">Topic:</label>
          <select id="expTopic" value={expTopic} onChange={(e) => setExpTopic(e.target.value)}>
            <option value="war">War</option>
            <option value="immigration">Immigration</option>
            <option value="socialism">Socialism</option>
            <option value="territorial_disputes">Territorial Disputes</option>
            <option value="economic_policy">Economic Policy</option>
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="expRounds">Rounds:</label>
          <input
            id="expRounds"
            type="number"
            min={3}
            max={30}
            value={expRounds}
            onChange={(e) => setExpRounds(parseInt(e.target.value) || 15)}
          />
        </div>
        <div className="form-row">
          <label>Historical agents (for exp 5-8):</label>
          <div className="agents">
            {["hitler", "gandhi", "jinnah"].map((a) => (
              <label key={a}>
                <input
                  type="checkbox"
                  checked={!!expAgents[a]}
                  onChange={() => setExpAgents((prev) => ({ ...prev, [a]: !prev[a] }))}
                />{" "}
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </label>
            ))}
          </div>
        </div>
        <div className="form-row">
          <button onClick={runExperiment} disabled={expLoading}>
            {expLoading ? (
              <><span className="spinner" />Running...</>
            ) : (
              "Run Experiment"
            )}
          </button>
        </div>

        {/* Experiment results */}
        {expResult && !expResult.error && (
          <div style={{ marginTop: "1rem" }}>
            {/* ---- DOWNLOAD BUTTON — EXPERIMENT ---- */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <h3 style={{ margin: 0 }}>Experiment Results</h3>
              <button
                className="secondary"
                onClick={() => {
                  const agents = expResult.experiment ?? "experiment";
                  const topic = expResult.topic ?? "topic";
                  downloadJson(expResult, `agonai_${agents}_${topic}_${Date.now()}.json`);
                }}
              >
                Download JSON
              </button>
            </div>

            <div className="chat-stats">
              <div className="stats-row">
                <span className="stat-chip">{expResult.experiment ?? ""}</span>
                <span className={`stat-chip status-${expResult.status}`}>{expResult.status}</span>
                <span className="stat-chip">Consensus: {roundTwo(expResult.consensus_score)}</span>
                <span className="stat-chip">Rounds: {expResult.rounds_played}</span>
                {expResult.convergence_round && (
                  <span className="stat-chip">Converged: Round {expResult.convergence_round}</span>
                )}
              </div>
            </div>

            {expResult.transcript?.length > 0 && (
              <div className="chat-container">
                {expResult.transcript.map(
                  (t: { round_number?: number; speaker?: string; response?: string }, i: number) => {
                    const msg: ChatMsg = {
                      round: t.round_number ?? 0,
                      speaker: t.speaker ?? "Unknown",
                      content: t.response ?? "",
                    };
                    const order: string[] = [];
                    for (const tt of expResult.transcript) {
                      if (!order.includes(tt.speaker)) order.push(tt.speaker);
                    }
                    return (
                      <ChatBubble
                        key={i}
                        msg={msg}
                        alignRight={order.indexOf(msg.speaker) % 2 === 1}
                        delay={i * 0.06}
                      />
                    );
                  },
                )}
              </div>
            )}

            {expResult.empathy_ratios && Object.keys(expResult.empathy_ratios).length > 0 && (
              <div className="exp-section">
                <h4>Empathy Ratios</h4>
                <div className="exp-empathy-bars">
                  {Object.entries(expResult.empathy_ratios).map(([name, val]) => {
                    const pct = Math.round((val as number) * 100);
                    const color = getColor(name);
                    return (
                      <div className="exp-empathy-row" key={name}>
                        <span className="exp-empathy-name" style={{ color }}>{name}</span>
                        <div className="exp-empathy-track">
                          <div className="exp-empathy-fill" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <span className="exp-empathy-val">{roundTwo(val as number)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {expResult.policy_scores && Object.keys(expResult.policy_scores).length > 0 && (
              <div className="exp-section">
                <h4>Policy Scores</h4>
                <ScoreCards scores={expResult.policy_scores} />
              </div>
            )}

            {expResult.judge_verdict && (
              <div className="judge-verdict">
                <h4>Judge Verdict</h4>
                <p>
                  <b>Winner:</b> {expResult.judge_verdict.winner ?? "No clear winner"} (margin:{" "}
                  {roundTwo(expResult.judge_verdict.margin)})
                </p>
                <p>
                  <b>Convergence:</b>{" "}
                  {expResult.judge_verdict.convergence_round
                    ? `Round ${expResult.judge_verdict.convergence_round}`
                    : "None"}{" "}
                  (metric: {roundTwo(expResult.judge_verdict.convergence_metric)})
                </p>
                {expResult.judge_verdict.recommendations?.length > 0 && (
                  <ul>
                    {expResult.judge_verdict.recommendations.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {expResult?.error && (
          <div className="exp-error" style={{ marginTop: "1rem" }}>
            {expResult.error}
          </div>
        )}
      </section>

      {/* Raw JSON + Download */}
      <section className="panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0 }}>Raw Data</h2>
          {result && !result.error && (
            <button
              className="secondary"
              onClick={() => {
                const agents = (result.agents as string[] ?? []).join("_vs_");
                const topic = (result.topic as string ?? "topic").replace(/\s+/g, "_");
                downloadJson(result, `agonai_${agents}_${topic}_${Date.now()}.json`);
              }}
            >
              Download JSON
            </button>
          )}
        </div>
        <pre className="code">{rawJson || "Run a simulation to see results here."}</pre>
      </section>
    </div>
  );
}

