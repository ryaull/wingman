// ===== CONSTANTS =====
const GOALS = {
  casual: "relaxed, friendly, match their energy, keep it light",
  flirt: "playful, charming, confident, a little teasing — never crude or explicit",
  formal: "polite, professional, clear and respectful",
  revive: "the chat is going dry — re-spark it with a question, hook, or fresh topic"
};

const PLACEHOLDERS = [
  "she went quiet, help me bring it back",
  "wanna ask him out without being awkward",
  "need to say no but stay friendly",
  "make this sound less boring lol",
  "convince my friend to come out tonight",
  "reply to my boss without sounding stiff"
];

let selectedGoal = "casual";
let isDarkMode = false;

// ===== HELPER FUNCTIONS =====
function readConversation() {
  const winW = window.innerWidth;
  const out = [];
  const seen = new Set();
  document.querySelectorAll('div[dir="auto"]').forEach(b => {
    const txt = b.innerText.trim();
    if (!txt || txt.length > 300 || seen.has(txt)) return;
    if (["Message...", "Seen", "Active now"].some(n => txt.includes(n))) return;
    if (/^\d{1,2}:\d{2}/.test(txt) || /sent an attachment/i.test(txt)) return;
    const rect = b.getBoundingClientRect();
    if (rect.width === 0 || rect.left < winW * 0.22) return;
    const who = (rect.left + rect.width / 2) > winW * 0.55 ? "You" : "Them";
    seen.add(txt);
    out.push(`${who}: ${txt}`);
  });
  return out.slice(-15).join("\n");
}

function insertReply(text) {
  const box = document.querySelector('div[contenteditable="true"]') ||
    document.querySelector('textarea[placeholder="Message..."]');
  if (!box) return false;
  box.focus();
  document.execCommand("insertText", false, text);
  return true;
}

// ===== GENERATE FUNCTION =====
async function generate() {
  const out = document.getElementById("wm-out");
  if (!out) return;

  const { groqKey } = await chrome.storage.local.get("groqKey");

  if (!groqKey) {
    out.innerHTML = `
      <div class="wm-key-section">
        <span class="wm-key-icon">🔑</span>
        <p>You'll need a free Groq API key<br>to generate smart replies</p>
        <a class="wm-key-link" href="https://console.groq.com/keys" target="_blank">Get your free key →</a>
        <input id="wm-keybox" placeholder="Paste your API key here & press Enter">
      </div>
    `;
    const keybox = document.getElementById("wm-keybox");
    if (keybox) {
      keybox.addEventListener("keydown", function handler(e) {
        if (e.key === "Enter") {
          chrome.storage.local.set({ groqKey: e.target.value.trim() }, () => generate());
        }
      });
    }
    return;
  }

  const convo = readConversation();
  const intent = document.getElementById("wm-intent");
  const count = document.getElementById("wm-count");

  if (!intent || !count) return;

  const intentText = intent.value;
  const countVal = count.value;

  out.innerHTML = `
    <div class="wm-loading">
      <div class="wm-spinner"></div>
      <span>Thinking of the perfect replies...</span>
    </div>
  `;

  const prompt = `You are a sharp, witty texting wingman. Conversation so far (recent at bottom):

${convo}

The user wants their reply to be: ${GOALS[selectedGoal] || "casual"}.
${intentText ? "Their goal: " + intentText : ""}

Give exactly ${countVal} reply option(s) in natural texting style. Use an emoji occasionally ONLY when it truly fits — most replies none, never more than one. Output ONLY the replies, one per line, no numbering, no quotes.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + groqKey
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9
      })
    });

    const data = await res.json();
    if (!data.choices) throw new Error("Invalid response from API");

    const replies = data.choices[0].message.content.trim().split("\n")
      .map(l => l.replace(/^\d+[\.\)]\s*/, "").replace(/^["']|["']$/g, "").trim())
      .filter(Boolean);

    out.innerHTML = "";
    replies.forEach((r, i) => {
      const div = document.createElement("div");
      div.className = "wm-sugg";
      div.style.animationDelay = (i * 0.08) + "s";
      div.innerHTML = `
        <div class="reply-text">${r}</div>
        <div class="reply-actions">
          <button class="action-insert">📤 Insert</button>
          <button class="action-copy">📋 Copy</button>
        </div>
      `;

      div.querySelector(".action-insert").onclick = (e) => {
        e.stopPropagation();
        insertReply(r);
        const btn = e.target;
        btn.textContent = "✅ Inserted!";
        btn.style.background = "#10b981";
        setTimeout(() => {
          btn.textContent = "📤 Insert";
          btn.style.background = "";
        }, 2000);
      };

      div.querySelector(".action-copy").onclick = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(r);
        const btn = e.target;
        btn.textContent = "✅ Copied!";
        btn.style.background = "#10b981";
        btn.style.color = "white";
        setTimeout(() => {
          btn.textContent = "📋 Copy";
          btn.style.background = "";
          btn.style.color = "";
        }, 2000);
      };

      div.onclick = () => {
        insertReply(r);
        div.style.borderColor = "#10b981";
        div.style.background = "rgba(16, 185, 129, 0.1)";
        setTimeout(() => {
          div.style.borderColor = "";
          div.style.background = "";
        }, 1500);
      };

      out.appendChild(div);
    });

    const moreBtn = document.getElementById("wm-more");
    if (moreBtn) moreBtn.style.display = "block";
  } catch (e) {
    out.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #ef4444; font-size: 14px;">
        <div style="font-size: 40px; margin-bottom: 8px;">⚠️</div>
        <div style="font-weight: 600;">Something went wrong</div>
        <div style="margin-top: 4px; color: var(--wm-text-muted);">${e.message || "Please try again"}</div>
      </div>
    `;
  }
}

// ===== INJECT UI =====
function injectUI() {
  if (document.getElementById("wm-root")) return;

  const logo = chrome.runtime.getURL("logo.png");

  // Add styles
  const style = document.createElement("style");
  style.textContent = `
    #wm-root, #wm-root * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    #wm-root {
      --wm-bg-primary: #ffffff;
      --wm-bg-secondary: #f8f9fc;
      --wm-bg-tertiary: #f1f3f8;
      --wm-text-primary: #0a0a1a;
      --wm-text-secondary: #4a4a6a;
      --wm-text-muted: #8a8aaa;
      --wm-border: rgba(0, 0, 0, 0.08);
      --wm-shadow: rgba(0, 0, 0, 0.08);
      --wm-shadow-heavy: rgba(0, 0, 0, 0.15);
      --wm-gradient-start: #667eea;
      --wm-gradient-end: #764ba2;
      --wm-glow: rgba(102, 126, 234, 0.3);
      --wm-surface: rgba(255, 255, 255, 0.9);
    }
    
    #wm-root.dark {
      --wm-bg-primary: #0a0a1a;
      --wm-bg-secondary: #141424;
      --wm-bg-tertiary: #1e1e3a;
      --wm-text-primary: #f0f0ff;
      --wm-text-secondary: #a0a0c0;
      --wm-text-muted: #606080;
      --wm-border: rgba(255, 255, 255, 0.08);
      --wm-shadow: rgba(0, 0, 0, 0.4);
      --wm-shadow-heavy: rgba(0, 0, 0, 0.6);
      --wm-surface: rgba(20, 20, 40, 0.95);
    }

    #wm-fab {
      position: fixed;
      z-index: 2147483647;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: none;
      cursor: grab;
      padding: 0;
      background: linear-gradient(135deg, var(--wm-gradient-start), var(--wm-gradient-end));
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 32px var(--wm-glow);
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      animation: wmFloat 3s ease-in-out infinite;
    }
    #wm-fab::before {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--wm-gradient-start), var(--wm-gradient-end));
      opacity: 0.3;
      filter: blur(12px);
      transition: all 0.4s;
    }
    #wm-fab:hover {
      transform: scale(1.08) translateY(-3px);
      box-shadow: 0 12px 48px var(--wm-glow);
    }
    #wm-fab:active { transform: scale(0.92); }
    #wm-fab img {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
      position: relative;
      z-index: 1;
    }
    #wm-fab.dragging {
      cursor: grabbing;
      transform: scale(0.92);
      animation: none;
    }
    #wm-fab.peek {
      transform: translateX(60px) scale(0.8);
      opacity: 0.3;
    }
    #wm-fab.peek:hover {
      transform: translateX(0) scale(1.08);
      opacity: 1;
    }
    #wm-fab.hidden { display: none !important; }

    @keyframes wmFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }

    #wm-panel {
      position: fixed;
      z-index: 2147483647;
      width: 420px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      background: var(--wm-surface);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border-radius: 28px;
      color: var(--wm-text-primary);
      box-shadow: 0 32px 80px var(--wm-shadow-heavy);
      opacity: 0;
      transform: translateY(24px) scale(0.96);
      pointer-events: none;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      border: 1px solid var(--wm-border);
    }
    #wm-panel.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    #wm-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 24px 16px;
      cursor: grab;
      user-select: none;
      border-bottom: 1px solid var(--wm-border);
      position: relative;
    }
    #wm-header.drag { cursor: grabbing; }
    #wm-header .wm-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }
    #wm-header .wm-brand img {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      object-fit: cover;
      background: linear-gradient(135deg, var(--wm-gradient-start), var(--wm-gradient-end));
      padding: 6px;
    }
    #wm-header .wm-brand h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      background: linear-gradient(135deg, var(--wm-gradient-start), var(--wm-gradient-end));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    #wm-header .wm-brand span {
      font-size: 12px;
      color: var(--wm-text-muted);
      font-weight: 400;
      -webkit-text-fill-color: var(--wm-text-muted);
    }
    .wm-header-actions {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .wm-header-btn {
      width: 34px;
      height: 34px;
      border: none;
      border-radius: 50%;
      background: var(--wm-bg-tertiary);
      cursor: pointer;
      color: var(--wm-text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.25s;
      font-size: 16px;
    }
    .wm-header-btn:hover {
      background: var(--wm-border);
      transform: rotate(15deg) scale(1.05);
    }
    #wm-close:hover { transform: rotate(90deg) scale(1.05); }

    #wm-body {
      overflow-y: auto;
      padding: 20px 24px 24px;
      scroll-behavior: smooth;
      flex: 1;
    }
    #wm-body::-webkit-scrollbar { width: 5px; }
    #wm-body::-webkit-scrollbar-track { background: transparent; }
    #wm-body::-webkit-scrollbar-thumb {
      background: var(--wm-border);
      border-radius: 10px;
    }
    #wm-body::-webkit-scrollbar-thumb:hover { background: var(--wm-text-muted); }

    .wm-label {
      font-size: 10px;
      color: var(--wm-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 700;
      margin: 22px 0 10px;
    }
    .wm-label:first-of-type { margin-top: 0; }

    .wm-goals {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .wm-g {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border: 2px solid var(--wm-border);
      border-radius: 14px;
      background: var(--wm-bg-secondary);
      color: var(--wm-text-secondary);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
      overflow: hidden;
    }
    .wm-g::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, var(--wm-gradient-start), var(--wm-gradient-end));
      opacity: 0;
      transition: opacity 0.3s;
    }
    .wm-g svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      position: relative;
      z-index: 1;
      transition: all 0.3s;
    }
    .wm-g span { position: relative; z-index: 1; }
    .wm-g:hover {
      border-color: var(--wm-gradient-start);
      transform: translateY(-2px);
      box-shadow: 0 8px 24px var(--wm-shadow);
    }
    .wm-g.on {
      border-color: transparent;
      color: white;
      transform: translateY(-2px);
      box-shadow: 0 8px 24px var(--wm-glow);
    }
    .wm-g.on::before { opacity: 1; }
    .wm-g.on svg { color: white; }

    #wm-intent {
      width: 100%;
      background: var(--wm-bg-secondary);
      color: var(--wm-text-primary);
      border: 2px solid var(--wm-border);
      border-radius: 14px;
      padding: 14px 16px;
      font-size: 14px;
      resize: vertical;
      min-height: 56px;
      outline: none;
      transition: all 0.3s;
      font-family: inherit;
      line-height: 1.6;
    }
    #wm-intent:focus {
      border-color: var(--wm-gradient-start);
      box-shadow: 0 0 0 4px var(--wm-glow);
      background: var(--wm-bg-primary);
    }
    #wm-intent::placeholder { color: var(--wm-text-muted); }

    .wm-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 14px;
      font-size: 13px;
      color: var(--wm-text-muted);
    }
    #wm-count {
      background: var(--wm-bg-secondary);
      color: var(--wm-text-primary);
      border: 2px solid var(--wm-border);
      border-radius: 10px;
      padding: 5px 10px;
      outline: none;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.3s;
      font-weight: 600;
    }
    #wm-count:focus { border-color: var(--wm-gradient-start); }

    .wm-btn {
      width: 100%;
      margin-top: 14px;
      padding: 16px;
      border: none;
      border-radius: 16px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 700;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      font-family: inherit;
      position: relative;
      overflow: hidden;
    }
    .wm-btn-primary {
      background: linear-gradient(135deg, var(--wm-gradient-start), var(--wm-gradient-end));
      color: white;
      box-shadow: 0 8px 24px var(--wm-glow);
    }
    .wm-btn-primary::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, var(--wm-gradient-end), var(--wm-gradient-start));
      opacity: 0;
      transition: opacity 0.4s;
    }
    .wm-btn-primary:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 36px var(--wm-glow);
    }
    .wm-btn-primary:hover::before { opacity: 1; }
    .wm-btn-primary:active { transform: scale(0.97); }
    .wm-btn-primary span { position: relative; z-index: 1; }
    
    .wm-btn-secondary {
      background: var(--wm-bg-secondary);
      color: var(--wm-text-secondary);
      border: 2px solid var(--wm-border);
    }
    .wm-btn-secondary:hover {
      border-color: var(--wm-gradient-start);
      transform: translateY(-2px);
      box-shadow: 0 8px 24px var(--wm-shadow);
    }

    .wm-sugg {
      background: var(--wm-bg-secondary);
      border: 2px solid var(--wm-border);
      border-radius: 18px;
      padding: 18px 20px;
      margin-top: 12px;
      cursor: pointer;
      animation: wmSlideIn 0.5s ease both;
      transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
    }
    .wm-sugg::before {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 20px;
      background: linear-gradient(135deg, var(--wm-gradient-start), var(--wm-gradient-end));
      opacity: 0;
      transition: opacity 0.35s;
      z-index: -1;
    }
    .wm-sugg:first-of-type { margin-top: 14px; }
    .wm-sugg:hover {
      border-color: transparent;
      transform: translateX(6px) translateY(-2px);
      box-shadow: 0 8px 32px var(--wm-shadow);
    }
    .wm-sugg:hover::before { opacity: 0.15; }
    .wm-sugg .reply-text {
      font-size: 15px;
      line-height: 1.7;
      color: var(--wm-text-primary);
      margin-bottom: 14px;
    }
    .wm-sugg .reply-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .wm-sugg .reply-actions button {
      padding: 6px 16px;
      border: none;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      font-family: inherit;
      letter-spacing: 0.01em;
    }
    .wm-sugg .action-insert {
      background: linear-gradient(135deg, var(--wm-gradient-start), var(--wm-gradient-end));
      color: white;
    }
    .wm-sugg .action-insert:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 16px var(--wm-glow);
    }
    .wm-sugg .action-copy {
      background: var(--wm-bg-tertiary);
      color: var(--wm-text-secondary);
    }
    .wm-sugg .action-copy:hover {
      background: var(--wm-border);
      transform: scale(1.05);
    }

    @keyframes wmSlideIn {
      from { opacity: 0; transform: translateY(16px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .wm-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 40px 0;
      color: var(--wm-text-muted);
      font-size: 14px;
    }
    .wm-spinner {
      width: 32px;
      height: 32px;
      border: 4px solid var(--wm-border);
      border-top-color: var(--wm-gradient-start);
      border-radius: 50%;
      animation: wmSpin 0.8s linear infinite;
    }
    @keyframes wmSpin { to { transform: rotate(360deg); } }

    .wm-key-section {
      text-align: center;
      padding: 20px 0;
    }
    .wm-key-section .wm-key-icon {
      font-size: 48px;
      margin-bottom: 12px;
      display: block;
    }
    .wm-key-section p {
      color: var(--wm-text-secondary);
      font-size: 14px;
      margin: 0 0 16px;
      line-height: 1.6;
    }
    .wm-key-link {
      display: inline-block;
      color: var(--wm-gradient-start);
      font-weight: 600;
      text-decoration: none;
      margin-bottom: 14px;
      transition: all 0.3s;
    }
    .wm-key-link:hover {
      text-decoration: underline;
      transform: translateX(4px);
    }
    #wm-keybox {
      width: 100%;
      background: var(--wm-bg-secondary);
      color: var(--wm-text-primary);
      border: 2px solid var(--wm-border);
      border-radius: 14px;
      padding: 12px 16px;
      font-size: 13px;
      outline: none;
      transition: all 0.3s;
      font-family: inherit;
    }
    #wm-keybox:focus {
      border-color: var(--wm-gradient-start);
      box-shadow: 0 0 0 4px var(--wm-glow);
    }

    .wm-shortcut {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--wm-border);
      font-size: 11px;
      color: var(--wm-text-muted);
      text-align: center;
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .wm-shortcut kbd {
      display: inline-block;
      background: var(--wm-bg-tertiary);
      border: 1px solid var(--wm-border);
      border-radius: 6px;
      padding: 2px 10px;
      font-family: inherit;
      font-size: 11px;
      font-weight: 700;
      color: var(--wm-text-secondary);
      box-shadow: 0 1px 3px var(--wm-shadow);
    }

    @media (max-width: 500px) {
      #wm-panel {
        width: 92vw;
        max-height: 88vh;
        border-radius: 20px;
      }
      #wm-body { padding: 16px; }
      #wm-header { padding: 16px; }
      .wm-goals { grid-template-columns: 1fr 1fr; gap: 6px; }
      .wm-g { font-size: 12px; padding: 8px 12px; }
    }
  `;
  document.head.appendChild(style);

  // Icons
  const ic = {
    casual: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="10"/></svg>`,
    flirt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    formal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6"/><circle cx="12" cy="12" r="10"/></svg>`,
    revive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"/></svg>`,
    theme: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
  };

  // Create root element
  const root = document.createElement("div");
  root.id = "wm-root";
  if (isDarkMode) root.classList.add("dark");
  root.innerHTML = `
    <button id="wm-fab"><img src="${logo}" alt="Wingman"></button>
    <div id="wm-panel">
      <div id="wm-header">
        <div class="wm-brand">
          <img src="${logo}" alt="">
          <div>
            <h2>Wingman</h2>
            <span>AI texting assistant</span>
          </div>
        </div>
        <div class="wm-header-actions">
          <button class="wm-header-btn" id="wm-theme-toggle" title="Toggle theme">${ic.theme}</button>
          <button class="wm-header-btn" id="wm-close">✕</button>
        </div>
      </div>
      <div id="wm-body">
        <div class="wm-label">🎯 Choose your vibe</div>
        <div class="wm-goals">
          <button class="wm-g on" data-g="casual">${ic.casual} <span>Casual</span></button>
          <button class="wm-g" data-g="flirt">${ic.flirt} <span>Flirt</span></button>
          <button class="wm-g" data-g="formal">${ic.formal} <span>Formal</span></button>
          <button class="wm-g" data-g="revive">${ic.revive} <span>Revive</span></button>
        </div>
        
        <div class="wm-label">💭 What's your goal?</div>
        <textarea id="wm-intent" placeholder=""></textarea>
        
        <div class="wm-row">
          <span>Suggest</span>
          <select id="wm-count">
            <option>1</option>
            <option>2</option>
            <option selected>3</option>
          </select>
          <span>replies</span>
        </div>
        
        <button class="wm-btn wm-btn-primary" id="wm-go"><span>✨ Generate Replies</span></button>
        <button class="wm-btn wm-btn-secondary" id="wm-more" style="display:none;">🔄 Different ones</button>
        
        <div id="wm-out"></div>
        
        <div class="wm-shortcut">
          <span><kbd>Alt</kbd> + <kbd>W</kbd> Toggle</span>
          <span><kbd>Drag</kbd> Reposition</span>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  // ===== Get elements =====
  const fab = document.getElementById("wm-fab");
  const panel = document.getElementById("wm-panel");
  const intent = document.getElementById("wm-intent");
  const themeToggle = document.getElementById("wm-theme-toggle");
  const closeBtn = document.getElementById("wm-close");
  const goBtn = document.getElementById("wm-go");
  const moreBtn = document.getElementById("wm-more");
  const header = document.getElementById("wm-header");

  // ===== Theme =====
  if (themeToggle) {
    themeToggle.onclick = () => {
      isDarkMode = !isDarkMode;
      root.classList.toggle("dark", isDarkMode);
      chrome.storage.local.set({ wmTheme: isDarkMode });
    };
  }

  chrome.storage.local.get(["wmTheme"], d => {
    if (d.wmTheme !== undefined) {
      isDarkMode = d.wmTheme;
      root.classList.toggle("dark", isDarkMode);
    }
  });

  // ===== Placeholder rotation =====
  if (intent) {
    let pi = Math.floor(Math.random() * PLACEHOLDERS.length);
    intent.placeholder = "e.g. " + PLACEHOLDERS[pi];
    setInterval(() => {
      if (document.activeElement !== intent && !intent.value) {
        pi = (pi + 1) % PLACEHOLDERS.length;
        intent.placeholder = "e.g. " + PLACEHOLDERS[pi];
      }
    }, 4000);
  }

  // ===== Position =====
  function positionPanel() {
    if (!fab || !panel) return;
    const r = fab.getBoundingClientRect();
    const top = Math.max(16, r.top - 500);
    panel.style.left = Math.max(16, r.left - 340) + "px";
    panel.style.top = top + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  chrome.storage.local.get(["wmFab"], d => {
    if (d.wmFab && fab) {
      fab.style.left = d.wmFab.x + "px";
      fab.style.top = d.wmFab.y + "px";
    } else if (fab) {
      fab.style.right = "28px";
      fab.style.bottom = "28px";
    }
    positionPanel();
  });

  // ===== FAB drag =====
  if (fab) {
    let fdrag = false, moved = false, fx = 0, fy = 0;
    fab.addEventListener("mousedown", e => {
      fdrag = true;
      moved = false;
      fab.classList.add("dragging");
      const r = fab.getBoundingClientRect();
      fx = e.clientX - r.left;
      fy = e.clientY - r.top;
      fab.style.right = "auto";
      fab.style.bottom = "auto";
    });
    document.addEventListener("mousemove", e => {
      if (!fdrag || !fab) return;
      moved = true;
      fab.style.left = (e.clientX - fx) + "px";
      fab.style.top = (e.clientY - fy) + "px";
    });
    document.addEventListener("mouseup", () => {
      if (fdrag && fab) {
        fdrag = false;
        fab.classList.remove("dragging");
        const r = fab.getBoundingClientRect();
        chrome.storage.local.set({ wmFab: { x: r.left, y: r.top } });
        if (!moved && panel) {
          panel.classList.toggle("open");
          positionPanel();
        }
      }
    });
  }

  // ===== Close =====
  if (closeBtn) closeBtn.onclick = () => panel.classList.remove("open");

  // ===== Panel drag =====
  if (header && panel) {
    let pdrag = false, px = 0, py = 0;
    header.addEventListener("mousedown", e => {
      if (e.target.closest(".wm-header-actions")) return;
      pdrag = true;
      header.classList.add("drag");
      const r = panel.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
    });
    document.addEventListener("mousemove", e => {
      if (!pdrag || !panel) return;
      panel.style.left = (e.clientX - px) + "px";
      panel.style.top = (e.clientY - py) + "px";
    });
    document.addEventListener("mouseup", () => {
      pdrag = false;
      if (header) header.classList.remove("drag");
    });
  }

  // ===== Goals =====
  root.querySelectorAll(".wm-g").forEach(b => {
    b.onclick = () => {
      root.querySelectorAll(".wm-g").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      selectedGoal = b.dataset.g;
    };
  });

  // ===== Generate buttons =====
  if (goBtn) goBtn.onclick = generate;
  if (moreBtn) moreBtn.onclick = generate;

  // ===== Peek & hide =====
  if (fab) {
    let hidden = false;
    let peekTimer;

    function startPeekTimer() {
      clearTimeout(peekTimer);
      fab.classList.remove("peek");
      peekTimer = setTimeout(() => fab.classList.add("peek"), 3500);
    }
    startPeekTimer();

    fab.addEventListener("mouseenter", () => {
      clearTimeout(peekTimer);
      fab.classList.remove("peek");
    });
    fab.addEventListener("mouseleave", startPeekTimer);
    fab.addEventListener("mousedown", () => {
      clearTimeout(peekTimer);
      fab.classList.remove("peek");
    });
    document.addEventListener("mouseup", startPeekTimer);

    document.addEventListener("keydown", (e) => {
      if (e.altKey && (e.key === "w" || e.key === "W")) {
        e.preventDefault();
        hidden = !hidden;
        fab.classList.toggle("hidden", hidden);
        if (hidden && panel) panel.classList.remove("open");
        if (!hidden) startPeekTimer();
      }
    });
  }
}

// ===== INIT =====
function tryInject() {
  if (document.body && !document.getElementById("wm-root")) {
    injectUI();
  }
}

tryInject();
setInterval(tryInject, 2000);