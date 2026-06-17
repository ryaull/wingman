document.getElementById("save").addEventListener("click", () => {
  const key = document.getElementById("key").value.trim();
  chrome.storage.local.set({ groqKey: key }, () => {
    document.getElementById("status").textContent = "✅ Saved!";
  });
});
chrome.storage.local.get("groqKey", (d) => {
  if (d.groqKey) document.getElementById("key").value = d.groqKey;
});