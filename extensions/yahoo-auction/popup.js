const apiUrlInput    = document.getElementById("apiUrl");
const cronSecretInput = document.getElementById("cronSecret");
const saveBtn        = document.getElementById("save");
const msgEl          = document.getElementById("msg");

// Load saved settings
chrome.storage.sync.get(["apiUrl", "cronSecret"], (data) => {
  if (data.apiUrl)     apiUrlInput.value     = data.apiUrl;
  if (data.cronSecret) cronSecretInput.value = data.cronSecret;
});

saveBtn.addEventListener("click", () => {
  const apiUrl     = apiUrlInput.value.trim().replace(/\/$/, "");
  const cronSecret = cronSecretInput.value.trim();

  if (!apiUrl) {
    showMsg("API URL を入力してください", true);
    return;
  }
  if (!cronSecret) {
    showMsg("CRON_SECRET を入力してください", true);
    return;
  }

  chrome.storage.sync.set({ apiUrl, cronSecret }, () => {
    showMsg("保存しました ✓");
  });
});

function showMsg(text, isError = false) {
  msgEl.textContent = text;
  msgEl.className   = "msg" + (isError ? " error" : "");
  setTimeout(() => { msgEl.textContent = ""; }, 3000);
}
