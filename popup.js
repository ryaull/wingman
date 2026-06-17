let selectedGoal = "casual";
let convoText = "";
let activeTabId = null;

const goalPrompts = {
  casual: "relaxed, friendly, match their energy, keep it light",
  flirt: "playful, charming, confident, a little teasing — never crude or explicit",
  formal: "polite, professional, clear and respectful",
  revive: "the chat is going dry — re-spark it with a question, hook, or fresh topic"
};

document.getElementById("gear").onclick = () => chrome.runtime.openOptionsPage();

document.querySelectorAll(".goal-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".goal-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedGoal = btn.dataset.goal;
  };
});

document.getElementById("start").onclick = async () => {
  const gate = document.getElementById("gate");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { gate.innerHTML = `<p style="color:#e8a14b;font-size:13px;">No active tab.</p>`; return; }
    activeTabId = tab.id;
    gate.innerHTML = `<p style="font-size:13px;color:#9aa0b0;">Reading chat...</p>`;
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    chrome.tabs.sendMessage(tab.id, { action: "read" }, (resp) => {
      if (chrome.runtime.lastError) { gate.innerHTML = `<p style="color:#e8a14b;font-size:13px;">Couldn't read: ${chrome.runtime.lastError.message}</p>`; return; }
      convoText = resp?.convo || "";
      if (!convoText) { gate.innerHTML = `<p style="color:#e8a14b;font-size:13px;">No messages found. Open a chat and try again.</p>`; return; }
      unlock();
    });
  } catch (e) { gate.innerHTML = `<p style="color:#e8a14b;font-size:13px;">Error: ${e.message}</p>`; }
};

function unlock() {
  document.getElementById("gate").style.display = "none";
  document.getElementById("main").classList.add("on");
}

async function generate() {
  const { groqKey } = await chrome.storage.local.get("groqKey");
  const out = document.getElementById("output");
  if (!groqKey) { out.innerHTML = `<div class="note">No API key. Click ⚙️ to add it.</div>`; return; }

  const intent = document.getElementById("intent").value;
  const count = document.getElementById("count").value;
  out.innerHTML = `<div class="note">Thinking...</div>`;

  const prompt = `You are a sharp, witty texting wingman. Conversation so far (most recent at bottom):

${convoText}

The user wants their next reply to be: ${goalPrompts[selectedGoal]}.
${intent ? "Their specific goal: " + intent : ""}

Give exactly ${count} reply option(s). Output ONLY the replies, one per line, no numbering, no quotes, no extra text.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + groqKey },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], temperature: 0.9 })
    });
    const data = await res.json();
    const text = data.choices[0].message.content.trim();
    const replies = text.split("\n").map(l => l.replace(/^\d+[\.\)]\s*/, "").replace(/^["']|["']$/g, "").trim()).filter(Boolean);

    out.innerHTML = "";
    replies.forEach(r => {
      const card = document.createElement("div");
      card.className = "sugg";
      card.innerHTML = `<span>${r}</span><span class="ins">tap to insert ↵</span>`;
      card.onclick = () => {
        chrome.tabs.sendMessage(activeTabId, { action: "insert", text: r }, () => { });
        card.querySelector(".ins").textContent = "inserted ✓";
      };
      out.appendChild(card);
    });
    document.getElementById("more").style.display = "block";
  } catch (e) {
    out.innerHTML = `<div class="note">Error: ${e.message}</div>`;
  }
}

document.getElementById("suggest").onclick = generate;
document.getElementById("more").onclick = generate;