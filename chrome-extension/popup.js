/**
 * GCI eBay Collector — Popup Script
 */

(function () {
  "use strict";

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const notEbay       = document.getElementById("not-ebay");
  const ebayPanel     = document.getElementById("ebay-panel");
  const aliasSelect   = document.getElementById("alias-select");
  const aliasInfo     = document.getElementById("alias-info");
  const pageUrlEl     = document.getElementById("page-url");
  const scrapeBtn     = document.getElementById("scrape-btn");
  const statusBox     = document.getElementById("status-box");
  const previewCounts = document.getElementById("preview-counts");
  const cntFound      = document.getElementById("cnt-found");
  const cntAuto       = document.getElementById("cnt-auto");

  const settingsToggle = document.getElementById("settings-toggle");
  const settingsPanel  = document.getElementById("settings-panel");
  const apiBaseInput   = document.getElementById("api-base");
  const apiKeyInput    = document.getElementById("api-key");
  const saveSettingsBtn = document.getElementById("save-settings");

  // ── State ─────────────────────────────────────────────────────────────────
  let currentTab  = null;
  let aliases     = [];
  let lastResults = null;

  // ── Settings ──────────────────────────────────────────────────────────────
  function loadSettings(cb) {
    chrome.storage.local.get(["gciApiBase", "gciApiKey", "lastAliasId"], (data) => {
      apiBaseInput.value = data.gciApiBase ?? "";
      apiKeyInput.value  = data.gciApiKey  ?? "";
      cb(data);
    });
  }

  saveSettingsBtn.addEventListener("click", () => {
    chrome.storage.local.set({
      gciApiBase: apiBaseInput.value.trim(),
      gciApiKey:  apiKeyInput.value.trim(),
    }, () => showStatus("設定を保存しました", "ok", 1500));
  });

  settingsToggle.addEventListener("click", () => {
    settingsPanel.classList.toggle("open");
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    currentTab = tabs[0];
    const url  = currentTab?.url ?? "";
    pageUrlEl.textContent = url.length > 60 ? url.slice(0, 57) + "…" : url;

    const isEbay = /ebay\.(com|co\.jp)/.test(url);
    if (!isEbay) {
      notEbay.style.display = "block";
      return;
    }

    ebayPanel.style.display = "block";
    loadSettings((settings) => loadAliases(settings.gciApiBase, settings.gciApiKey, settings.lastAliasId));
  });

  // ── Load aliases ──────────────────────────────────────────────────────────
  async function loadAliases(apiBase, apiKey, lastAliasId) {
    if (!apiBase) {
      aliasSelect.innerHTML = '<option value="">⚠ API URL を設定してください</option>';
      return;
    }

    try {
      const res  = await fetch(`${apiBase}/api/admin/ebay/aliases`, {
        headers: { "X-GCI-Key": apiKey ?? "" },
      });
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.aliases)) throw new Error(data.error ?? "aliases fetch failed");

      aliases = data.aliases;
      aliasSelect.innerHTML = aliases.length === 0
        ? '<option value="">CardAlias が未登録です</option>'
        : aliases.map((a) =>
            `<option value="${a.id}"${a.id === lastAliasId ? " selected" : ""}>` +
            `[${a.card?.game ?? "?"}] ${a.card?.name ?? ""} / ${a.name}` +
            `${a.cardNumber ? " (" + a.cardNumber + ")" : ""}` +
            `${a.language ? " — " + a.language : ""}` +
            `</option>`
          ).join("");

      updateAliasInfo();
    } catch (e) {
      aliasSelect.innerHTML = '<option value="">⚠ 読み込みエラー</option>';
      showStatus("Aliasの読み込みに失敗しました: " + e.message, "err");
    }
  }

  aliasSelect.addEventListener("change", updateAliasInfo);

  function updateAliasInfo() {
    const a = aliases.find((x) => x.id === aliasSelect.value);
    if (!a) { aliasInfo.style.display = "none"; return; }
    aliasInfo.style.display = "block";
    aliasInfo.textContent =
      `Query: ${a.searchQuery ?? a.name}` +
      (a.cardNumber ? ` · #${a.cardNumber}` : "") +
      (a.language   ? ` · ${a.language}` : "");
  }

  // ── Scrape & send ─────────────────────────────────────────────────────────
  scrapeBtn.addEventListener("click", async () => {
    const aliasId = aliasSelect.value;
    if (!aliasId) { showStatus("CardAlias を選択してください", "err"); return; }

    scrapeBtn.disabled = true;
    scrapeBtn.textContent = "解析中…";
    previewCounts.style.display = "none";
    hideStatus();

    try {
      // 1. Content script でページを解析
      const scrapeRes = await chrome.tabs.sendMessage(currentTab.id, { type: "GCI_SCRAPE" });
      if (!scrapeRes?.ok) throw new Error(scrapeRes?.error ?? "scrape failed");

      const { listings } = scrapeRes;
      if (!listings || listings.length === 0) {
        showStatus("出品データが見つかりませんでした。\neBay Sold検索結果ページを開いてください。", "info");
        return;
      }

      cntFound.textContent = String(listings.length);
      cntAuto.textContent  = "…";
      previewCounts.style.display = "grid";
      scrapeBtn.textContent = "送信中…";

      // 2. GCI APIに送信
      const settings = await new Promise((resolve) =>
        chrome.storage.local.get(["gciApiBase", "gciApiKey"], resolve)
      );
      const apiBase = settings.gciApiBase;
      const apiKey  = settings.gciApiKey;
      if (!apiBase) { showStatus("API URLが設定されていません", "err"); return; }

      // 最後に使ったAliasを保存
      chrome.storage.local.set({ lastAliasId: aliasId });

      const importRes = await fetch(`${apiBase}/api/admin/collector/ebay/extension-import`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GCI-Key":    apiKey ?? "",
        },
        body: JSON.stringify({ cardAliasId: aliasId, listings }),
      });

      const result = await importRes.json();
      lastResults = result;

      if (!result.ok) throw new Error(result.error ?? "import failed");

      cntAuto.textContent = String(result.autoImported ?? 0);

      const msg = [
        `✓ ${result.saved} 件保存`,
        `自動import: ${result.autoImported} 件`,
        `確認待ち: ${result.pending} 件`,
        result.priceMedianUsd != null
          ? `価格中央値: $${result.priceMedianUsd.toFixed(2)}`
          : "価格中央値: データ不足（3件未満）",
      ].join("\n");
      showStatus(msg, "ok");

    } catch (e) {
      showStatus("エラー: " + e.message, "err");
      previewCounts.style.display = "none";
    } finally {
      scrapeBtn.disabled = false;
      scrapeBtn.textContent = "このページを解析 & 送信";
    }
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function showStatus(msg, type, autoDismissMs) {
    statusBox.textContent  = msg;
    statusBox.className    = "status " + type;
    statusBox.style.display = "block";
    if (autoDismissMs) setTimeout(hideStatus, autoDismissMs);
  }

  function hideStatus() {
    statusBox.style.display = "none";
  }
})();
