/* AgonAI Frontend - Chat-based debate interface */

const AGENT_COLORS = {
  'Adolf Hitler': '#e11d48',
  'Mahatma Gandhi': '#22c55e',
  'Muhammad Ali Jinnah': '#38bdf8',
  'Rational Agent': '#8b5cf6',
  'Rational-A': '#8b5cf6',
  'Rational-B': '#a78bfa',
  'Empathetic Agent': '#f59e0b',
  'Empathetic-A': '#f59e0b',
  'Empathetic-B': '#fbbf24',
  'Low-Empathy': '#ef4444',
  'High-Empathy': '#10b981',
  'Rational': '#8b5cf6',
  'Empathetic': '#f59e0b',
};

function getAgentColor(name) {
  return AGENT_COLORS[name] || '#6366f1';
}

function agentBubbleStyle(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    bg: `rgba(${r}, ${g}, ${b}, 0.12)`,
    text: `rgb(${Math.round(r * 0.45)}, ${Math.round(g * 0.45)}, ${Math.round(b * 0.45)})`,
    border: `rgba(${r}, ${g}, ${b}, 0.25)`,
  };
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* Typewriter effect: reveals words one by one */
function typewriterEffect(element, text, wordsPerTick = 3, intervalMs = 40) {
  return new Promise((resolve) => {
    const words = text.split(/(\s+)/); // preserve whitespace
    let index = 0;
    element.innerHTML = '';
    const timer = setInterval(() => {
      if (index >= words.length) {
        clearInterval(timer);
        resolve();
        return;
      }
      const chunk = words.slice(index, index + wordsPerTick).join('');
      element.innerHTML += escapeHtml(chunk).replace(/\n/g, '<br>');
      index += wordsPerTick;
      // Keep scrolling the container
      const container = element.closest('.chat-container');
      if (container) container.scrollTop = container.scrollHeight;
    }, intervalMs);
  });
}

/* Render chat messages one by one with typewriter effect */
async function renderChatMessagesAnimated(container, messages) {
  container.innerHTML = '';
  const speakerOrder = [];
  messages.forEach((msg) => {
    if (!speakerOrder.includes(msg.speaker)) speakerOrder.push(msg.speaker);
  });

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const color = getAgentColor(msg.speaker);
    const style = agentBubbleStyle(color);
    const idx = speakerOrder.indexOf(msg.speaker);
    const alignRight = idx % 2 === 1;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.style.background = style.bg;
    bubble.style.border = `1px solid ${style.border}`;
    if (alignRight) bubble.style.alignSelf = 'flex-end';

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.style.background = color;
    avatar.textContent = getInitials(msg.speaker);

    const body = document.createElement('div');
    body.className = 'chat-body';

    const speaker = document.createElement('div');
    speaker.className = 'chat-speaker';
    speaker.style.color = color;
    speaker.innerHTML = `${escapeHtml(msg.speaker)} <span class="chat-round">Round ${msg.round}</span>`;

    const text = document.createElement('div');
    text.className = 'chat-text';
    text.style.color = style.text;

    body.appendChild(speaker);
    body.appendChild(text);
    bubble.appendChild(avatar);
    bubble.appendChild(body);
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;

    // Typewriter effect for each message
    await typewriterEffect(text, msg.content);
  }
}

/* Instant render (for experiment results where streaming isn't needed) */
function renderChatMessages(container, messages) {
  container.innerHTML = '';
  const speakerOrder = [];
  messages.forEach((msg) => {
    if (!speakerOrder.includes(msg.speaker)) speakerOrder.push(msg.speaker);
  });

  messages.forEach((msg, i) => {
    const color = getAgentColor(msg.speaker);
    const style = agentBubbleStyle(color);
    const idx = speakerOrder.indexOf(msg.speaker);
    const alignRight = idx % 2 === 1;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.style.background = style.bg;
    bubble.style.border = `1px solid ${style.border}`;
    bubble.style.animationDelay = `${i * 0.06}s`;
    if (alignRight) bubble.style.alignSelf = 'flex-end';

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.style.background = color;
    avatar.textContent = getInitials(msg.speaker);

    const body = document.createElement('div');
    body.className = 'chat-body';

    const speaker = document.createElement('div');
    speaker.className = 'chat-speaker';
    speaker.style.color = color;
    speaker.innerHTML = `${escapeHtml(msg.speaker)} <span class="chat-round">Round ${msg.round}</span>`;

    const text = document.createElement('div');
    text.className = 'chat-text';
    text.style.color = style.text;
    text.innerHTML = escapeHtml(msg.content).replace(/\n/g, '<br>');

    body.appendChild(speaker);
    body.appendChild(text);
    bubble.appendChild(avatar);
    bubble.appendChild(body);
    container.appendChild(bubble);
  });
  container.scrollTop = container.scrollHeight;
}

function renderStats(container, data) {
  const empathyHtml = data.empathyRatios
    ? Object.entries(data.empathyRatios).map(([name, val]) =>
        `<span class="stat-chip"><b>${name}</b> empathy: ${val}</span>`
      ).join('')
    : '';
  container.innerHTML = `
    <div class="stats-row">
      <span class="stat-chip status-${data.status}">${data.status}</span>
      <span class="stat-chip">Consensus: ${data.consensusScore}</span>
      <span class="stat-chip">Rounds: ${data.rounds}</span>
      <span class="stat-chip">Duration: ${data.durationMinutes}m</span>
      ${empathyHtml}
    </div>
  `;
}

function roundTwo(val) {
  if (val == null) return '—';
  return Number(val).toFixed(2);
}

function renderPolicyScores(container, scores) {
  if (!scores) { container.style.display = 'none'; return; }
  container.style.display = '';
  let html = '';
  for (const [name, card] of Object.entries(scores)) {
    const color = getAgentColor(name);
    const cs = card.cumulative_scores || {};
    html += `
      <div class="score-card">
        <h3 style="color:${color}">${name}</h3>
        <div class="score-dims">
          ${renderDim('Political', cs.political)}
          ${renderDim('Economic', cs.economic)}
          ${renderDim('Social', cs.social)}
        </div>
        <div class="score-meta">
          <span>Objective: <b>${roundTwo(card.final_objective)}</b></span>
          <span>Fatigue: ${roundTwo(card.fatigue)}</span>
          <span>Empathy bonus: ${roundTwo(card.empathy_bonus)}</span>
          <span>Penalties: ${roundTwo(card.penalties)}</span>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}

function renderDim(label, dim) {
  if (!dim) return '';
  const netClass = dim.net >= 0 ? 'positive' : 'negative';
  return `
    <div class="dim">
      <span class="dim-label">${label}</span>
      <span class="dim-bar">
        <span class="bar-benefit" style="width:${Math.min(dim.benefit, 100)}%"></span>
        <span class="bar-cost" style="width:${Math.min(dim.cost, 100)}%"></span>
      </span>
      <span class="dim-net ${netClass}">${dim.net > 0 ? '+' : ''}${roundTwo(dim.net)}</span>
    </div>
  `;
}

async function runSimulation() {
  const agentInputs = Array.from(document.querySelectorAll('.agent'));
  const agents = agentInputs.filter(a => a.checked).map(a => a.value);
  const topicSelect = document.getElementById('topicSelect').value;
  const topicInput = document.getElementById('topic').value.trim();
  const topic = topicSelect === 'custom' ? topicInput : topicSelect;
  const rounds = parseInt(document.getElementById('rounds').value, 10) || 12;
  const summaryOnly = document.getElementById('summaryOnly').checked;
  const sessionId = window.localStorage.getItem('sessionId') || undefined;

  const resultsEl = document.getElementById('results');
  const chatPanel = document.getElementById('chatPanel');
  const chatContainer = document.getElementById('chatContainer');
  const chatStats = document.getElementById('chatStats');
  const scoresPanel = document.getElementById('scoresPanel');
  const scoresGrid = document.getElementById('scoresGrid');
  const runBtn = document.getElementById('runBtn');

  runBtn.classList.add('loading');
  runBtn.innerHTML = '<span class="spinner"></span>Running\u2026';
  resultsEl.innerHTML = '<div class="loading-text"><span class="spinner"></span>Running simulation\u2026</div>';
  chatPanel.style.display = 'none';
  chatPanel.classList.remove('panel-reveal');
  scoresPanel.style.display = 'none';
  scoresPanel.classList.remove('panel-reveal');

  if (agents.length < 2) {
    resultsEl.textContent = 'Please select at least 2 agents to start a debate.';
    runBtn.classList.remove('loading');
    runBtn.textContent = 'Run Debate';
    return;
  }
  if (!topic) {
    resultsEl.textContent = 'Please enter or select a debate topic.';
    runBtn.classList.remove('loading');
    runBtn.textContent = 'Run Debate';
    return;
  }

  try {
    const resp = await fetch('/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agents, topic, rounds, summaryOnly, sessionId })
    });

    const data = await resp.json();
    if (!resp.ok) {
      resultsEl.textContent = JSON.stringify(data, null, 2);
      return;
    }

    if (data.sessionId) {
      window.localStorage.setItem('sessionId', data.sessionId);
    }

    // Show chat interface with typewriter effect
    if (data.chatMessages && data.chatMessages.length > 0) {
      chatPanel.style.display = '';
      chatPanel.classList.add('panel-reveal');
      renderStats(chatStats, data);
      resultsEl.innerHTML = '';
      await renderChatMessagesAnimated(chatContainer, data.chatMessages);
    }

    // Show policy scores
    if (data.policyScores) {
      scoresPanel.style.display = '';
      scoresPanel.classList.add('panel-reveal');
      renderPolicyScores(scoresGrid, data.policyScores);
    }

    resultsEl.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    resultsEl.textContent = String(err);
  } finally {
    runBtn.classList.remove('loading');
    runBtn.textContent = 'Run Debate';
  }
}

/* Render experiment results in a user-friendly format */
function renderExperimentDetails(container, data) {
  let html = '';

  // Summary card
  html += `<div class="exp-summary-card">`;
  html += `<h4>${escapeHtml(data.experiment || 'Experiment')}</h4>`;
  html += `<div class="exp-summary-grid">`;
  html += `<div class="exp-metric"><span class="exp-metric-label">Status</span><span class="exp-metric-value status-${data.status}">${data.status}</span></div>`;
  html += `<div class="exp-metric"><span class="exp-metric-label">Consensus</span><span class="exp-metric-value">${roundTwo(data.consensus_score)}</span></div>`;
  html += `<div class="exp-metric"><span class="exp-metric-label">Rounds</span><span class="exp-metric-value">${data.rounds_played}</span></div>`;
  if (data.convergence_round) {
    html += `<div class="exp-metric"><span class="exp-metric-label">Converged at</span><span class="exp-metric-value">Round ${data.convergence_round}</span></div>`;
  }
  html += `</div>`;
  html += `</div>`;

  // Empathy ratios
  if (data.empathy_ratios && Object.keys(data.empathy_ratios).length > 0) {
    html += `<div class="exp-section"><h4>Empathy Ratios</h4><div class="exp-empathy-bars">`;
    for (const [name, val] of Object.entries(data.empathy_ratios)) {
      const pct = Math.round(val * 100);
      const color = getAgentColor(name);
      html += `
        <div class="exp-empathy-row">
          <span class="exp-empathy-name" style="color:${color}">${escapeHtml(name)}</span>
          <div class="exp-empathy-track">
            <div class="exp-empathy-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <span class="exp-empathy-val">${roundTwo(val)}</span>
        </div>`;
    }
    html += `</div></div>`;
  }

  // Agreements & Disagreements
  if (data.key_agreements && data.key_agreements.length > 0) {
    html += `<div class="exp-section"><h4>Key Agreements</h4><ul class="exp-list exp-list-agree">`;
    data.key_agreements.forEach(a => { html += `<li>${escapeHtml(a)}</li>`; });
    html += `</ul></div>`;
  }
  if (data.key_disagreements && data.key_disagreements.length > 0) {
    html += `<div class="exp-section"><h4>Key Disagreements</h4><ul class="exp-list exp-list-disagree">`;
    data.key_disagreements.forEach(d => { html += `<li>${escapeHtml(d)}</li>`; });
    html += `</ul></div>`;
  }

  // Policy scores
  if (data.policy_scores && Object.keys(data.policy_scores).length > 0) {
    html += `<div class="exp-section"><h4>Policy Scores</h4><div class="scores-grid">`;
    for (const [name, card] of Object.entries(data.policy_scores)) {
      const color = getAgentColor(name);
      const cs = card.cumulative_scores || {};
      html += `
        <div class="score-card">
          <h3 style="color:${color}">${escapeHtml(name)}</h3>
          <div class="score-dims">
            ${renderDim('Political', cs.political)}
            ${renderDim('Economic', cs.economic)}
            ${renderDim('Social', cs.social)}
          </div>
          <div class="score-meta">
            <span>Objective: <b>${roundTwo(card.final_objective)}</b></span>
            <span>Fatigue: ${roundTwo(card.fatigue)}</span>
            <span>Empathy bonus: ${roundTwo(card.empathy_bonus)}</span>
            <span>Penalties: ${roundTwo(card.penalties)}</span>
          </div>
        </div>`;
    }
    html += `</div></div>`;
  }

  // Judge verdict
  if (data.judge_verdict) {
    const jv = data.judge_verdict;
    html += `<div class="judge-verdict">`;
    html += `<h4>Judge Verdict</h4>`;
    html += `<p><b>Winner:</b> ${escapeHtml(jv.winner || 'No clear winner')} (margin: ${roundTwo(jv.margin)})</p>`;
    html += `<p><b>Convergence:</b> ${jv.convergence_round ? 'Round ' + jv.convergence_round : 'None'} (metric: ${roundTwo(jv.convergence_metric)})</p>`;
    if (jv.recommendations && jv.recommendations.length > 0) {
      html += '<ul>' + jv.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('') + '</ul>';
    }
    html += `</div>`;
  }

  container.innerHTML = html;
}

async function runExperiment() {
  const expId = parseInt(document.getElementById('expSelect').value, 10);
  const topic = document.getElementById('expTopic').value;
  const maxRounds = parseInt(document.getElementById('expRounds').value, 10) || 15;
  const histAgents = Array.from(document.querySelectorAll('.exp-agent'))
    .filter(a => a.checked).map(a => a.value);

  const expResults = document.getElementById('expResults');
  const expStats = document.getElementById('expStats');
  const expChat = document.getElementById('expChat');
  const expDetails = document.getElementById('expDetails');
  const runExpBtn = document.getElementById('runExpBtn');

  runExpBtn.classList.add('loading');
  runExpBtn.innerHTML = '<span class="spinner"></span>Running\u2026';
  expResults.style.display = 'none';
  expResults.classList.remove('panel-reveal');
  expChat.innerHTML = '';
  expDetails.innerHTML = '<div class="loading-text"><span class="spinner"></span>Running experiment\u2026</div>';
  expResults.style.display = '';
  expResults.classList.add('panel-reveal');

  try {
    const resp = await fetch('/experiment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experimentId: expId,
        topic,
        maxRounds,
        historicalAgents: histAgents,
      })
    });
    const data = await resp.json();

    // Stats chips
    expStats.innerHTML = `
      <div class="stats-row">
        <span class="stat-chip">${escapeHtml(data.experiment || '')}</span>
        <span class="stat-chip status-${data.status}">${data.status}</span>
        <span class="stat-chip">Consensus: ${roundTwo(data.consensus_score)}</span>
        <span class="stat-chip">Rounds: ${data.rounds_played}</span>
        ${data.convergence_round ? `<span class="stat-chip">Converged: Round ${data.convergence_round}</span>` : ''}
      </div>
    `;

    // Chat transcript if available
    if (data.transcript && data.transcript.length > 0) {
      const chatMsgs = data.transcript.map(t => ({
        round: t.round_number || t.round || 0,
        speaker: t.speaker || 'Unknown',
        content: t.response || t.content || '',
      }));
      renderChatMessages(expChat, chatMsgs);
    }

    // Rich details
    renderExperimentDetails(expDetails, data);
  } catch (err) {
    expDetails.innerHTML = `<div class="exp-error">${escapeHtml(String(err))}</div>`;
  } finally {
    runExpBtn.classList.remove('loading');
    runExpBtn.textContent = 'Run Experiment';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('runBtn').addEventListener('click', runSimulation);
  document.getElementById('runExpBtn').addEventListener('click', runExperiment);

  // Topic select sync
  document.getElementById('topicSelect').addEventListener('change', (e) => {
    if (e.target.value !== 'custom') {
      document.getElementById('topic').value = e.target.value;
    }
  });

  // Jump buttons
  document.getElementById('jumpToConfig').addEventListener('click', () => {
    document.getElementById('configPanel').scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('jumpToExperiments').addEventListener('click', () => {
    document.getElementById('experimentPanel').scrollIntoView({ behavior: 'smooth' });
  });

  // Agent profile on map
  const agentData = {
    hitler: {
      name: 'Adolf Hitler',
      origin: 'Germany',
      bio: 'Authoritarian nationalist persona with low cooperativeness and rigid red lines on territorial control.',
      tags: ['Dominance: High', 'Cooperativeness: Low', 'Ideology: Fascism'],
      avatarClass: 'avatar-hitler',
      initials: 'AH',
      focusPrompt: 'Begin with a guarded, high-stakes negotiation framing about sovereignty.'
    },
    gandhi: {
      name: 'Mahatma Gandhi',
      origin: 'India',
      bio: 'Nonviolent negotiator emphasizing moral appeals, empathy-weighted memory, and consensus building.',
      tags: ['Justice: High', 'Cooperativeness: High', 'Ideology: Nonviolence'],
      avatarClass: 'avatar-gandhi',
      initials: 'MG',
      focusPrompt: 'Open with a compassion-forward dialogue on shared humanitarian goals.'
    },
    jinnah: {
      name: 'Muhammad Ali Jinnah',
      origin: 'Pakistan',
      bio: 'Strategic constitutionalist balancing pragmatism with assertive negotiation over autonomy and rights.',
      tags: ['Assertiveness: High', 'Pragmatism: Medium', 'Ideology: Muslim Nationalism'],
      avatarClass: 'avatar-jinnah',
      initials: 'MJ',
      focusPrompt: 'Frame a legalistic discussion about self-determination and governance safeguards.'
    }
  };

  const profileName = document.getElementById('profileName');
  const profileOrigin = document.getElementById('profileOrigin');
  const profileBio = document.getElementById('profileBio');
  const profileTags = document.getElementById('profileTags');
  const profileAvatar = document.getElementById('profileAvatar');
  const addToDebateBtn = document.getElementById('addToDebate');
  const focusChatBtn = document.getElementById('focusChat');
  let activeAgentKey = null;

  function setProfile(agentKey) {
    const data = agentData[agentKey];
    if (!data) return;
    activeAgentKey = agentKey;
    profileName.textContent = data.name;
    profileOrigin.textContent = `Origin: ${data.origin}`;
    profileBio.textContent = data.bio;
    profileAvatar.className = `avatar ${data.avatarClass}`;
    profileAvatar.textContent = data.initials;
    profileTags.innerHTML = '';
    data.tags.forEach(tag => {
      const chip = document.createElement('span');
      chip.textContent = tag;
      profileTags.appendChild(chip);
    });
    addToDebateBtn.disabled = false;
    focusChatBtn.disabled = false;
  }

  document.querySelectorAll('.agent-marker').forEach(marker => {
    const agentKey = marker.dataset.agent;
    marker.addEventListener('mouseenter', () => setProfile(agentKey));
    marker.addEventListener('focus', () => setProfile(agentKey));
    marker.addEventListener('click', () => {
      setProfile(agentKey);
      toggleAgent(agentKey, true);
    });
  });

  addToDebateBtn.addEventListener('click', () => {
    if (!activeAgentKey) return;
    toggleAgent(activeAgentKey, true);
    document.getElementById('configPanel').scrollIntoView({ behavior: 'smooth' });
  });

  focusChatBtn.addEventListener('click', () => {
    if (!activeAgentKey) return;
    const prompt = agentData[activeAgentKey]?.focusPrompt;
    if (prompt) {
      document.getElementById('topic').value = prompt;
      document.getElementById('topicSelect').value = 'custom';
    }
    toggleAgent(activeAgentKey, true);
    document.getElementById('configPanel').scrollIntoView({ behavior: 'smooth' });
  });

  function toggleAgent(agentKey, shouldSelect) {
    const checkbox = document.querySelector(`.agent[value="${agentKey}"]`);
    if (checkbox) {
      checkbox.checked = shouldSelect ?? !checkbox.checked;
    }
  }
});
