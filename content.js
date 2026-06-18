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

function injectUI() {
  if (document.getElementById("wm-root")) return;
  const logo = chrome.runtime.getURL("logo.png");

  const style = document.createElement("style");
  style.textContent = `
    #wm-root, #wm-root * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    
    /* Modern FAB */
    #wm-fab { 
      position: fixed; 
      z-index: 2147483647; 
      width: 60px; 
      height: 60px; 
      border-radius: 50%; 
      border: none; 
      cursor: grab; 
      padding: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex; 
      align-items: center; 
      justify-content: center; 
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    #wm-fab:hover { 
      transform: scale(1.05) translateY(-2px);
      box-shadow: 0 8px 30px rgba(102, 126, 234, 0.5);
    }
    #wm-fab:active { transform: scale(0.95); }
    #wm-fab img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
    #wm-fab.dragging { cursor: grabbing; transform: scale(0.95); }
    
    /* Panel */
    #wm-panel {
      position: fixed;
      z-index: 2147483647;
      width: 380px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(20px);
      border-radius: 24px;
      color: #1a1a2e;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
      opacity: 0;
      transform: translateY(20px) scale(0.96);
      pointer-events: none;
      transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    #wm-panel.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    
    /* Header */
    #wm-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 24px 16px;
      cursor: grab;
      user-select: none;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    }
    #wm-bar.drag { cursor: grabbing; }
    #wm-bar img {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
    }
    #wm-bar h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    #wm-close {
      margin-left: auto;
      width: 32px;
      height: 32px;
      border: none;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 50%;
      cursor: pointer;
      color: #6b7280;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    #wm-close:hover {
      background: rgba(0, 0, 0, 0.1);
      color: #1a1a2e;
      transform: rotate(90deg);
    }
    
    /* Body */
    #wm-body {
      overflow-y: auto;
      padding: 20px 24px 24px;
      scroll-behavior: smooth;
    }
    #wm-body::-webkit-scrollbar { width: 6px; }
    #wm-body::-webkit-scrollbar-track { background: transparent; }
    #wm-body::-webkit-scrollbar-thumb { 
      background: rgba(0, 0, 0, 0.15);
      border-radius: 10px;
    }
    #wm-body::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.25); }
    
    /* Labels */
    .wm-label {
      font-size: 11px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-weight: 600;
      margin: 20px 0 10px;
    }
    .wm-label:first-of-type { margin-top: 0; }
    
    /* Goal buttons */
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
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      background: transparent;
      color: #4b5563;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .wm-g svg {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }
    .wm-g:hover {
      border-color: #667eea;
      color: #1a1a2e;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
    }
    .wm-g.on {
      background: linear-gradient(135deg, #667eea, #764ba2);
      border-color: transparent;
      color: white;
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
    }
    .wm-g.on svg { color: white; }
    
    /* Textarea */
    #wm-intent {
      width: 100%;
      background: #f9fafb;
      color: #1a1a2e;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 14px;
      resize: vertical;
      min-height: 50px;
      outline: none;
      transition: all 0.2s;
      font-family: inherit;
    }
    #wm-intent:focus {
      border-color: #667eea;
      background: white;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
    }
    #wm-intent::placeholder { color: #9ca3af; }
    
    /* Row */
    .wm-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 14px;
      font-size: 13px;
      color: #6b7280;
    }
    #wm-count {
      background: #f9fafb;
      color: #1a1a2e;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 4px 8px;
      outline: none;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    #wm-count:focus { border-color: #667eea; }
    
    /* Buttons */
    .wm-btn {
      width: 100%;
      margin-top: 14px;
      padding: 14px;
      border: none;
      border-radius: 14px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 600;
      transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      font-family: inherit;
    }
    .wm-btn-primary {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
    }
    .wm-btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
    }
    .wm-btn-primary:active { transform: translateY(0) scale(0.98); }
    
    .wm-btn-secondary {
      background: #f9fafb;
      color: #4b5563;
      border: 2px solid #e5e7eb;
    }
    .wm-btn-secondary:hover {
      background: #f3f4f6;
      border-color: #d1d5db;
      transform: translateY(-1px);
    }
    
    /* Suggestions */
    .wm-sugg {
      background: #f9fafb;
      border: 2px solid #e5e7eb;
      border-radius: 16px;
      padding: 16px 18px;
      margin-top: 12px;
      cursor: pointer;
      animation: wmslide .3s ease both;
      transition: all 0.25s ease;
      position: relative;
    }
    .wm-sugg:first-of-type { margin-top: 14px; }
    .wm-sugg:hover {
      border-color: #667eea;
      background: white;
      transform: translateX(4px);
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.1);
    }
    .wm-sugg .reply-text {
      font-size: 15px;
      line-height: 1.6;
      color: #1a1a2e;
      margin-bottom: 12px;
    }
    .wm-sugg .reply-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .wm-sugg .reply-actions button {
      padding: 4px 14px;
      border: none;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
    }
    .wm-sugg .action-insert {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
    }
    .wm-sugg .action-insert:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }
    .wm-sugg .action-copy {
      background: #e5e7eb;
      color: #4b5563;
    }
    .wm-sugg .action-copy:hover {
      background: #d1d5db;
      transform: scale(1.05);
    }
    
    /* Loading */
    .wm-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 30px 0;
      color: #6b7280;
      font-size: 14px;
    }
    .wm-spinner {
      width: 20px;
      height: 20px;
      border: 3px solid #e5e7eb;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes wmslide {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    /* Key input */
    .wm-key-section {
      text-align: center;
      padding: 10px 0;
    }
    .wm-key-section p {
      color: #6b7280;
      font-size: 14px;
      margin: 0 0 12px;
      line-height: 1.5;
    }
    .wm-key-link {
      display: inline-block;
      color: #667eea;
      font-weight: 600;
      text-decoration: none;
      margin-bottom: 12px;
    }
    .wm-key-link:hover { text-decoration: underline; }
    #wm-keybox {
      width: 100%;
      background: #f9fafb;
      color: #1a1a2e;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 13px;
      outline: none;
      transition: all 0.2s;
      font-family: inherit;
    }
    #wm-keybox:focus {
      border-color: #667eea;
      background: white;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
    }
    
    /* Shortcut hint */
    .wm-shortcut {
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid #e5e7eb;
      font-size: 11px;
      color: #9ca3af;
      text-align: center;
    }
    .wm-shortcut kbd {
      display: inline-block;
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 2px 8px;
      font-family: inherit;
      font-size: 11px;
      font-weight: 600;
      color: #4b5563;
    }
    
    /* Peek state */
    #wm-fab.peek {
      transform: translateX(50px) scale(0.85);
      opacity: 0.4;
    }
    #wm-fab.peek:hover {
      transform: translateX(0) scale(1.05);
      opacity: 1;
    }
    #wm-fab.hidden { display: none !important; }
  `;
  document.head.appendChild(style);

  const ic = {
    casual: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="10"/></svg>`,
    flirt: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    formal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6"/><circle cx="12" cy="12" r="10"/></svg>`,
    revive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"/></svg>`
  };

  const root = document.createElement("div");
  root.id = "wm-root";
  root.innerHTML = `
    <button id="wm-fab"><img src="${logo}" alt="Wingman"></button>
    <div id="wm-panel">
      <div id="wm-bar">
        <img src="${logo}" alt="">
        <h2>Wingman</h2>
        <button id="wm-close">✕</button>
      </div>
      <div id="wm-body">
        <div class="wm-label">Choose your vibe</div>
        <div class="wm-goals">
          <button class="wm-g on" data-g="casual">${ic.casual} Casual</button>
          <button class="wm-g" data-g="flirt">${ic.flirt} Flirt</button>
          <button class="wm-g" data-g="formal">${ic.formal} Formal</button>
          <button class="wm-g" data-g="revive">${ic.revive} Revive</button>
        </div>
        
        <div class="wm-label">What would you like to say?</div>
        <textarea id="wm-intent" placeholder=""></textarea>
        
        <div class="wm-row">
          <span>Suggest</span>
          <select id="wm-count">
            <option>1</option>
            <option>2</option>
            <option selected>3</option>
          </select>
          <span>reply</span>
        </div>
        
        <button class="wm-btn wm-btn-primary" id="wm-go"> Generate Replies</button>
        <button class="wm-btn wm-btn-secondary" id="wm-more" style="display:none;"> Try Different</button>
        
        <div id="wm-out"></div>
        
        <div class="wm-shortcut">
          Press <kbd>Alt</kbd> + <kbd>W</kbd> to toggle
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const fab = document.getElementById("wm-fab");
  const panel = document.getElementById("wm-panel");
  const intent = document.getElementById("wm-intent");

  // Rotating placeholder
  let pi = Math.floor(Math.random() * PLACEHOLDERS.length);
  intent.placeholder = "e.g. " + PLACEHOLDERS[pi];
  setInterval(() => {
    if (document.activeElement !== intent && !intent.value) {
      pi = (pi + 1) % PLACEHOLDERS.length;
      intent.placeholder = "e.g. " + PLACEHOLDERS[pi];
    }
  }, 4000);

  // Restore position
  chrome.storage.local.get(["wmFab"], d => {
    if (d.wmFab) {
      fab.style.left = d.wmFab.x + "px";
      fab.style.top = d.wmFab.y + "px";
    } else {
      fab.style.right = "24px";
      fab.style.bottom = "24px";
    }
    positionPanel();
  });

  function positionPanel() {
    const r = fab.getBoundingClientRect();
    const top = Math.max(16, r.top - 480);
    panel.style.left = Math.max(16, r.left - 320) + "px";
    panel.style.top = top + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  // FAB drag
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
    if (!fdrag) return;
    moved = true;
    fab.style.left = (e.clientX - fx) + "px";
    fab.style.top = (e.clientY - fy) + "px";
  });
  document.addEventListener("mouseup", e => {
    if (fdrag) {
      fdrag = false;
      fab.classList.remove("dragging");
      const r = fab.getBoundingClientRect();
      chrome.storage.local.set({ wmFab: { x: r.left, y: r.top } });
      if (!moved) {
        panel.classList.toggle("open");
        positionPanel();
      }
    }
  });

  document.getElementById("wm-close").onclick = () => panel.classList.remove("open");

  // Panel drag
  const bar = document.getElementById("wm-bar");
  let pdrag = false, px = 0, py = 0;
  bar.addEventListener("mousedown", e => {
    if (e.target.closest("#wm-close")) return;
    pdrag = true;
    bar.classList.add("drag");
    const r = panel.getBoundingClientRect();
    px = e.clientX - r.left;
    py = e.clientY - r.top;
  });
  document.addEventListener("mousemove", e => {
    if (!pdrag) return;
    panel.style.left = (e.clientX - px) + "px";
    panel.style.top = (e.clientY - py) + "px";
  });
  document.addEventListener("mouseup", () => {
    pdrag = false;
    bar.classList.remove("drag");
  });

  // Goal selection
  root.querySelectorAll(".wm-g").forEach(b => {
    b.onclick = () => {
      root.querySelectorAll(".wm-g").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      selectedGoal = b.dataset.g;
    };
  });

  document.getElementById("wm-go").onclick = generate;
  document.getElementById("wm-more").onclick = generate;
}

async function generate() {
  const out = document.getElementById("wm-out");
  const { groqKey } = await chrome.storage.local.get("groqKey");

  if (!groqKey) {
    out.innerHTML = `
      <div class="wm-key-section">
        <p>🔑 You'll need a free Groq API key</p>
        <a class="wm-key-link" href="https://console.groq.com/keys" target="_blank">Get your free key →</a>
        <input id="wm-keybox" placeholder="Paste your Groq API key here & press Enter">
      </div>
    `;
    document.getElementById("wm-keybox").addEventListener("keydown", e => {
      if (e.key === "Enter") {
        chrome.storage.local.set({ groqKey: e.target.value.trim() }, () => generate());
      }
    });
    return;
  }

  const convo = readConversation();
  const intent = document.getElementById("wm-intent").value;
  const count = document.getElementById("wm-count").value;

  out.innerHTML = `
    <div class="wm-loading">
      <div class="wm-spinner"></div>
      <span>Crafting your replies...</span>
    </div>
  `;

  const prompt = `You are a sharp, witty texting wingman. Conversation so far (recent at bottom):

${convo}

The user wants their reply to be: ${GOALS[selectedGoal]}.
${intent ? "Their goal: " + intent : ""}

Give exactly ${count} reply option(s) in natural texting style. Use an emoji occasionally ONLY when it truly fits — most replies none, never more than one. Output ONLY the replies, one per line, no numbering, no quotes.`;

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
          <button class="action-insert">Insert</button>
          <button class="action-copy">Copy</button>
        </div>
      `;

      div.querySelector(".action-insert").onclick = (e) => {
        e.stopPropagation();
        insertReply(r);
        const btn = e.target;
        btn.textContent = "✓ Inserted";
        btn.style.background = "#10b981";
        setTimeout(() => {
          btn.textContent = "Insert";
          btn.style.background = "";
        }, 2000);
      };

      div.querySelector(".action-copy").onclick = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(r);
        const btn = e.target;
        btn.textContent = "✓ Copied";
        btn.style.background = "#10b981";
        btn.style.color = "white";
        setTimeout(() => {
          btn.textContent = "Copy";
          btn.style.background = "";
          btn.style.color = "";
        }, 2000);
      };

      // Click on suggestion to insert
      div.onclick = () => {
        insertReply(r);
        div.style.borderColor = "#10b981";
        div.style.background = "#f0fdf4";
        setTimeout(() => {
          div.style.borderColor = "";
          div.style.background = "";
        }, 1500);
      };

      out.appendChild(div);
    });

    document.getElementById("wm-more").style.display = "block";
  } catch (e) {
    out.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #ef4444; font-size: 14px;">
        <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
        <div>${e.message || "Something went wrong. Please try again."}</div>
      </div>
    `;
  }
}

// Initialize
const tryInject = () => {
  if (document.body && !document.getElementById("wm-root")) {
    injectUI();
  }
};
tryInject();
setInterval(tryInject, 2000);

// Peek + hide toggle
(function addPeekAndHide() {
  function setup() {
    const fab = document.getElementById("wm-fab");
    if (!fab) { setTimeout(setup, 1000); return; }

    let hidden = false;
    let peekTimer;

    function startPeekTimer() {
      clearTimeout(peekTimer);
      fab.classList.remove("peek");
      peekTimer = setTimeout(() => fab.classList.add("peek"), 3000);
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
        const panel = document.getElementById("wm-panel");
        if (hidden && panel) panel.classList.remove("open");
        if (!hidden) startPeekTimer();
      }
    });
  }
  setup();
})();