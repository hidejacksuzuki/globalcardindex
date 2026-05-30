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

// ── バッチ制御 ────────────────────────────────────────────────────────────────

const batchStartBtn  = document.getElementById("batch-start");
const batchStopBtn   = document.getElementById("batch-stop");
const progressDiv    = document.getElementById("batch-progress");
const batchIndexEl   = document.getElementById("batch-index");
const batchTotalEl   = document.getElementById("batch-total");
const batchBarEl     = document.getElementById("batch-bar");
const batchCurrentEl = document.getElementById("batch-current");
const batchResultsEl = document.getElementById("batch-results");

batchStartBtn.addEventListener("click", () => {
  chrome.storage.sync.get(["apiUrl", "cronSecret"], ({ apiUrl, cronSecret }) => {
    if (!apiUrl || !cronSecret) {
      showMsg("先にAPI URLとCRON_SECRETを保存してください", true);
      return;
    }
    chrome.runtime.sendMessage({ type: "START_BATCH", apiUrl, cronSecret }, (res) => {
      if (res?.ok) {
        batchStartBtn.style.display = "none";
        batchStopBtn.style.display  = "";
        progressDiv.style.display   = "";
        batchResultsEl.innerHTML    = "";
      } else {
        showMsg(res?.error ?? "開始失敗", true);
      }
    });
  });
});

batchStopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "STOP_BATCH" }, () => {
    batchStopBtn.style.display  = "none";
    batchStartBtn.style.display = "";
  });
});

// background からのリアルタイム更新を受け取る
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "BATCH_UPDATE") return;

  const pct = msg.total > 0 ? Math.round((msg.index / msg.total) * 100) : 0;
  batchIndexEl.textContent   = msg.index;
  batchTotalEl.textContent   = msg.total;
  batchBarEl.style.width     = pct + "%";
  batchCurrentEl.textContent = msg.current ? `処理中: ${msg.current}` : "";

  // 最新結果をリストに追記
  if (msg.results?.length) {
    const last = msg.results[msg.results.length - 1];
    const line = document.createElement("div");
    line.style.cssText = "padding:2px 0;border-bottom:1px solid #f0f0f0;";
    line.style.color   = last.error ? "#dc2626" : "#16a34a";
    line.textContent   = last.error
      ? `✗ ${last.name}: ${last.error}`
      : `✓ ${last.name}: ${last.saved}件`;
    batchResultsEl.prepend(line);
  }

  if (msg.done) {
    batchStopBtn.style.display  = "none";
    batchStartBtn.style.display = "";
    batchCurrentEl.textContent  = `完了！ ${msg.results?.length ?? 0}カード処理済み`;
  }

  if (msg.error) {
    showMsg(msg.error, true);
    batchStopBtn.style.display  = "none";
    batchStartBtn.style.display = "";
  }
});
