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
    #wm-root, #wm-root * { box-sizing: border-box; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
    #wm-fab { position: fixed; z-index: 2147483647; width: 56px; height: 56px; border-radius: 18px; border: none; cursor: grab; padding: 0;
      background: linear-gradient(135deg,#6e9bff,#9b6eff); display: flex; align-items: center; justify-content: center; overflow: hidden;
      box-shadow: 0 8px 30px rgba(123,128,255,.5); transition: transform .25s cubic-bezier(.2,.9,.2,1); }
    #wm-fab.dragging { cursor: grabbing; }
    #wm-fab img { width: 100%; height: 100%; object-fit: cover; }
    #wm-fab:hover { transform: translateY(-3px) scale(1.05); }
    #wm-tip { position: fixed; z-index: 2147483647; background: #2a2c36; color: #fff; font-size: 12px; padding: 7px 11px; border-radius: 9px;
      box-shadow: 0 6px 20px rgba(0,0,0,.4); display: none; }
    #wm-panel { position: fixed; z-index: 2147483647; width: 362px; max-height: 80vh; display: flex; flex-direction: column;
      background: linear-gradient(180deg, rgba(28,29,37,.98), rgba(17,18,23,.99)); backdrop-filter: blur(18px);
      border: 1px solid rgba(255,255,255,.09); border-radius: 24px; color: #ECEAE4; box-shadow: 0 30px 80px rgba(0,0,0,.6);
      opacity: 0; transform: translateY(18px) scale(.96); pointer-events: none; transition: .26s cubic-bezier(.2,.9,.2,1); }
    #wm-panel.open { opacity: 1; transform: none; pointer-events: auto; }
    #wm-bar { display: flex; align-items: center; gap: 11px; padding: 16px 18px 13px; cursor: grab; user-select: none; }
    #wm-bar.drag { cursor: grabbing; }
    #wm-bar img { width: 26px; height: 26px; border-radius: 8px; object-fit: cover; }
    #wm-bar h2 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -.01em; }
    #wm-grip { margin-left: auto; display: flex; gap: 3px; padding: 4px 8px; border-radius: 8px; background: rgba(255,255,255,.05); }
    #wm-grip span { width: 3px; height: 3px; border-radius: 50%; background: #6b707e; box-shadow: 0 6px 0 #6b707e, 0 -6px 0 #6b707e; }
    #wm-x { color: #6b707e; cursor: pointer; font-size: 16px; padding: 3px 6px; border-radius: 7px; }
    #wm-x:hover { background: rgba(255,255,255,.08); color: #fff; }
    #wm-body { overflow-y: auto; padding: 0 18px 18px; }
    #wm-body::-webkit-scrollbar { width: 8px; }
    #wm-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.13); border-radius: 8px; }
    .wm-label { font-size: 10px; color: #6b707e; margin: 15px 0 8px; text-transform: uppercase; letter-spacing: .14em; font-weight: 600; }
    .wm-goals { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .wm-g { display: flex; align-items: center; gap: 8px; padding: 11px 12px; border: 1px solid rgba(255,255,255,.07);
      border-radius: 13px; background: rgba(255,255,255,.03); color: #c9ccd4; font-size: 13px; font-weight: 500; cursor: pointer; transition: .16s; }
    .wm-g svg { width: 15px; height: 15px; opacity: .85; }
    .wm-g:hover { border-color: rgba(123,128,255,.5); color: #fff; transform: translateY(-1px); }
    .wm-g.on { background: linear-gradient(135deg, rgba(110,155,255,.25), rgba(155,110,255,.25)); border-color: rgba(123,128,255,.7); color: #fff; }
    #wm-intent { width: 100%; background: rgba(255,255,255,.03); color: #ECEAE4; border: 1px solid rgba(255,255,255,.07);
      border-radius: 13px; padding: 11px 12px; font-size: 13px; resize: vertical; min-height: 44px; outline: none; transition: .16s; }
    #wm-intent:focus { border-color: rgba(123,128,255,.6); }
    #wm-intent::placeholder { color: #5a5f6c; }
    .wm-row { display: flex; align-items: center; gap: 10px; margin-top: 14px; font-size: 13px; color: #8a8f9c; }
    #wm-count { background: rgba(255,255,255,.04); color: #ECEAE4; border: 1px solid rgba(255,255,255,.08); border-radius: 9px; padding: 7px 10px; outline: none; }
    .wm-btn { width: 100%; margin-top: 14px; padding: 13px; border: none; border-radius: 14px; cursor: pointer; font-size: 14px; font-weight: 600;
      background: linear-gradient(135deg,#6e9bff,#9b6eff); color: #fff; transition: .16s; }
    .wm-btn:hover { filter: brightness(1.07); transform: translateY(-1px); box-shadow: 0 8px 24px rgba(123,128,255,.4); }
    .wm-btn.ghost { background: rgba(255,255,255,.04); color: #c9ccd4; border: 1px solid rgba(255,255,255,.08); }
    .wm-sugg { background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 13px 14px; margin-top: 10px;
      font-size: 14px; line-height: 1.5; animation: wmpop .3s cubic-bezier(.2,.9,.2,1) both; }
    .wm-sugg .acts { display: flex; gap: 14px; margin-top: 9px; }
    .wm-sugg .act { font-size: 10px; color: #7b9bff; text-transform: uppercase; letter-spacing: .1em; font-weight: 600; cursor: pointer; }
    .wm-sugg .act:hover { color: #fff; }
    @keyframes wmpop { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    .wm-note { font-size: 13px; color: #8a8f9c; margin-top: 14px; line-height: 1.5; }
    .wm-keylink { display: inline-block; margin-top: 8px; color: #7b9bff; font-weight: 600; text-decoration: none; }
    #wm-keybox { width: 100%; margin-top: 10px; background: rgba(255,255,255,.03); color: #ECEAE4; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; padding: 9px; font-size: 12px; outline: none; }
    .wm-spin { display:inline-block; width:13px; height:13px; border:2px solid rgba(255,255,255,.2); border-top-color:#7b9bff; border-radius:50%; animation: wmspin .7s linear infinite; vertical-align: middle; margin-right: 7px; }
    @keyframes wmspin { to { transform: rotate(360deg);
    .wm-shortcut { margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.07); font-size: 11px; color: #6b707e; text-align: center; }
    .wm-shortcut kbd { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: 5px; padding: 1px 6px; font-family: monospace; font-size: 11px; color: #c9ccd4; } } }
  `;
  document.head.appendChild(style);

  const ic = {
    casual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 13a4 4 0 0 0 8 0"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="12" cy="12" r="10"/></svg>',
    flirt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z"/></svg>',
    formal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 7h-3V4a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v3H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM9 4h6v3H9z"/></svg>',
    revive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>'
  };

  const root = document.createElement("div");
  root.id = "wm-root";
  root.innerHTML = `
    <button id="wm-fab"><img src="${logo}" alt="Wingman"></button>
    <div id="wm-tip">Drag me anywhere · click to open</div>
    <div id="wm-panel">
      <div id="wm-bar">
        <img src="${logo}" alt="">
        <h2>Wingman</h2>
        <div id="wm-grip"><span></span><span></span></div>
        <span id="wm-x">✕</span>
      </div>
      <div id="wm-body">
        <div class="wm-label">Pick a vibe</div>
        <div class="wm-goals">
          <button class="wm-g on" data-g="casual">${ic.casual} Casual</button>
          <button class="wm-g" data-g="flirt">${ic.flirt} Flirt</button>
          <button class="wm-g" data-g="formal">${ic.formal} Formal</button>
          <button class="wm-g" data-g="revive">${ic.revive} Revive</button>
        </div>
        <div class="wm-label">What do you want</div>
        <textarea id="wm-intent" placeholder=""></textarea>
        <div class="wm-row">Suggestions:
          <select id="wm-count"><option>1</option><option>2</option><option selected>3</option></select>
        </div>
        <button class="wm-btn" id="wm-go">Suggest replies</button>
        <button class="wm-btn ghost" id="wm-more" style="display:none;">🔄 Different ones</button>
        <div id="wm-out"></div>
        <div class="wm-shortcut">Press <kbd>Alt</kbd> + <kbd>W</kbd> to hide / show</div>
      </div>
    </div>`;
  document.body.appendChild(root);

  const fab = document.getElementById("wm-fab");
  const panel = document.getElementById("wm-panel");
  const tip = document.getElementById("wm-tip");
  const intent = document.getElementById("wm-intent");

  // rotating placeholder
  let pi = Math.floor(Math.random() * PLACEHOLDERS.length);
  intent.placeholder = "e.g. " + PLACEHOLDERS[pi];
  setInterval(() => { if (document.activeElement !== intent && !intent.value) { pi = (pi + 1) % PLACEHOLDERS.length; intent.placeholder = "e.g. " + PLACEHOLDERS[pi]; } }, 3500);

  // restore saved position
  chrome.storage.local.get(["wmFab"], d => {
    if (d.wmFab) { fab.style.left = d.wmFab.x + "px"; fab.style.top = d.wmFab.y + "px"; }
    else { fab.style.right = "26px"; fab.style.bottom = "26px"; }
    positionPanel();
  });

  // first-time tooltip
  chrome.storage.local.get(["wmSeenTip"], d => {
    if (!d.wmSeenTip) {
      const r = fab.getBoundingClientRect();
      tip.style.left = (r.left - 150) + "px"; tip.style.top = (r.top + 16) + "px";
      tip.style.display = "block";
      setTimeout(() => tip.style.display = "none", 4000);
      chrome.storage.local.set({ wmSeenTip: true });
    }
  });

  function positionPanel() {
    const r = fab.getBoundingClientRect();
    const top = Math.max(20, r.top - 470);
    panel.style.left = Math.max(20, r.left - 306) + "px";
    panel.style.top = top + "px";
    panel.style.right = "auto"; panel.style.bottom = "auto";
  }

  // ---- FAB: drag vs click ----
  let fdrag = false, moved = false, fx = 0, fy = 0;
  fab.addEventListener("mousedown", e => {
    fdrag = true; moved = false; fab.classList.add("dragging");
    const r = fab.getBoundingClientRect();
    fx = e.clientX - r.left; fy = e.clientY - r.top;
    fab.style.right = "auto"; fab.style.bottom = "auto";
  });
  document.addEventListener("mousemove", e => {
    if (!fdrag) return;
    moved = true;
    fab.style.left = (e.clientX - fx) + "px";
    fab.style.top = (e.clientY - fy) + "px";
  });
  document.addEventListener("mouseup", e => {
    if (fdrag) {
      fdrag = false; fab.classList.remove("dragging");
      const r = fab.getBoundingClientRect();
      chrome.storage.local.set({ wmFab: { x: r.left, y: r.top } });
      if (!moved) { panel.classList.toggle("open"); positionPanel(); }
    }
  });

  document.getElementById("wm-x").onclick = () => panel.classList.remove("open");

  // ---- panel drag ----
  const bar = document.getElementById("wm-bar");
  let pdrag = false, px = 0, py = 0;
  bar.addEventListener("mousedown", e => {
    if (e.target.id === "wm-x") return;
    pdrag = true; bar.classList.add("drag");
    const r = panel.getBoundingClientRect();
    px = e.clientX - r.left; py = e.clientY - r.top;
  });
  document.addEventListener("mousemove", e => {
    if (!pdrag) return;
    panel.style.left = (e.clientX - px) + "px"; panel.style.top = (e.clientY - py) + "px";
  });
  document.addEventListener("mouseup", () => { pdrag = false; bar.classList.remove("drag"); });

  root.querySelectorAll(".wm-g").forEach(b => {
    b.onclick = () => {
      root.querySelectorAll(".wm-g").forEach(x => x.classList.remove("on"));
      b.classList.add("on"); selectedGoal = b.dataset.g;
    };
  });
  document.getElementById("wm-go").onclick = generate;
  document.getElementById("wm-more").onclick = generate;
}

async function generate() {
  const out = document.getElementById("wm-out");
  const { groqKey } = await chrome.storage.local.get("groqKey");
  if (!groqKey) {
    out.innerHTML = `<div class="wm-note">You need a free Groq API key first.<br>
      <a class="wm-keylink" href="https://console.groq.com/keys" target="_blank">→ Get your free key here</a>
      <input id="wm-keybox" placeholder="paste key here & press Enter">
    </div>`;
    document.getElementById("wm-keybox").addEventListener("keydown", e => {
      if (e.key === "Enter") { chrome.storage.local.set({ groqKey: e.target.value.trim() }, () => generate()); }
    });
    return;
  }

  const convo = readConversation();
  const intent = document.getElementById("wm-intent").value;
  const count = document.getElementById("wm-count").value;
  out.innerHTML = `<div class="wm-note"><span class="wm-spin"></span>Thinking…</div>`;

  const prompt = `You are a sharp, witty texting wingman. Conversation so far (recent at bottom):

${convo}

The user wants their reply to be: ${GOALS[selectedGoal]}.
${intent ? "Their goal: " + intent : ""}

Give exactly ${count} reply option(s) in natural texting style. Use an emoji occasionally ONLY when it truly fits — most replies none, never more than one. Output ONLY the replies, one per line, no numbering, no quotes.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + groqKey },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], temperature: 0.9 })
    });
    const data = await res.json();
    const replies = data.choices[0].message.content.trim().split("\n")
      .map(l => l.replace(/^\d+[\.\)]\s*/, "").replace(/^["']|["']$/g, "").trim()).filter(Boolean);

    out.innerHTML = "";
    replies.forEach((r, i) => {
      const c = document.createElement("div");
      c.className = "wm-sugg";
      c.style.animationDelay = (i * 0.06) + "s";
      c.innerHTML = `<div class="txt">${r}</div><div class="acts"><span class="act ins">insert ↵</span><span class="act cp">copy</span></div>`;
      c.querySelector(".ins").onclick = () => { insertReply(r); c.querySelector(".ins").textContent = "inserted ✓"; };
      c.querySelector(".cp").onclick = () => { navigator.clipboard.writeText(r); c.querySelector(".cp").textContent = "copied ✓"; };
      out.appendChild(c);
    });
    document.getElementById("wm-more").style.display = "block";
  } catch (e) {
    out.innerHTML = `<div class="wm-note">Error: ${e.message}</div>`;
  }
}

const tryInject = () => { if (document.body) injectUI(); };
tryInject();
setInterval(tryInject, 3000);
// ===== peek + hide toggle (added on top, doesn't touch drag) =====
(function addPeekAndHide() {
  function setup() {
    const fab = document.getElementById("wm-fab");
    if (!fab) { setTimeout(setup, 1000); return; }

    // inject peek styles once
    if (!document.getElementById("wm-peek-style")) {
      const s = document.createElement("style");
      s.id = "wm-peek-style";
      s.textContent = `
        #wm-fab { transition: transform .25s cubic-bezier(.2,.9,.2,1), opacity .25s; }
        #wm-fab.peek { transform: translateX(38px); opacity: .35; }
        #wm-fab.peek:hover { transform: translateX(0); opacity: 1; }
        #wm-fab.hidden { display: none !important; }
      `;
      document.head.appendChild(s);
    }

    let hidden = false;
    let peekTimer;

    // start peeking after 2.5s of no interaction
    function startPeekTimer() {
      clearTimeout(peekTimer);
      fab.classList.remove("peek");
      peekTimer = setTimeout(() => fab.classList.add("peek"), 2500);
    }
    startPeekTimer();

    // wake from peek on hover, re-arm timer when mouse leaves
    fab.addEventListener("mouseenter", () => { clearTimeout(peekTimer); fab.classList.remove("peek"); });
    fab.addEventListener("mouseleave", startPeekTimer);
    // any drag/click resets the peek timer
    fab.addEventListener("mousedown", () => { clearTimeout(peekTimer); fab.classList.remove("peek"); });
    document.addEventListener("mouseup", startPeekTimer);

    // Alt+W = fully show/hide
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