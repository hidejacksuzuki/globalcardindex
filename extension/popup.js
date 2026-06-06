/**
 * GCI Mercari Collector — popup.js
 *
 * フロー:
 *   1. 設定済み API Key を chrome.storage.local から読み込み
 *   2. 現在タブが Mercari 売切れ検索ページか確認
 *   3. URL の keyword からカードを GCI API で検索・表示
 *   4. ユーザーがカードを選択して「収集する」
 *   5. executeScript で Mercari ページからアイテムをスクレイプ
 *   6. POST /api/v1/import/market-results に送信
 *   7. 結果表示
 */

const API_BASE = "https://gci-data-hidejacksuzukis-projects.vercel.app";

// ── State ──────────────────────────────────────────────────────────────────────
let apiKey       = "";
let selectedCard = null;
let currentTab   = null;
let searchTimer  = null;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const mainView       = document.getElementById("main-view");
const settingsView   = document.getElementById("settings-view");
const btnToggle      = document.getElementById("btn-toggle-settings");
const btnSaveKey     = document.getElementById("btn-save-key");
const btnCancel      = document.getElementById("btn-cancel-settings");
const apiKeyInput    = document.getElementById("api-key-input");
const cardSearch     = document.getElementById("card-search");
const cardList       = document.getElementById("card-list");
const btnCollect     = document.getElementById("btn-collect");
const progressText   = document.getElementById("progress-text");
const pageAlert      = document.getElementById("page-alert");
const resultBox      = document.getElementById("result");
const resSaved       = document.getElementById("res-saved");
const resAuto        = document.getElementById("res-auto");
const resSkip        = document.getElementById("res-skip");

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  // Load API key
  const stored = await chrome.storage.local.get("apiKey");
  apiKey = stored.apiKey || "";

  // API Key 未設定なら設定画面を自動で開く
  if (!apiKey) {
    openSettings();
    return;
  }

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  if (!tab.url || !tab.url.includes("jp.mercari.com")) {
    showAlert("warn", "メルカリの検索ページで開いてください。");
    return;
  }

  let url;
  try { url = new URL(tab.url); } catch { return; }

  const status  = url.searchParams.get("status") || "";
  const keyword = url.searchParams.get("keyword") || "";

  if (status !== "sold_out") {
    showAlert("warn", 'status=sold_out の売切れページで開いてください。');
    return;
  }

  if (keyword) {
    cardSearch.value = keyword;
    searchCards(keyword);
  } else {
    showAlert("info", "メルカリ売切れページを検出しました。カードを検索してください。");
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────
function openSettings() {
  settingsView.style.display = "block";
  mainView.style.display     = "none";
  apiKeyInput.value = apiKey;
}

function closeSettings() {
  settingsView.style.display = "none";
  mainView.style.display     = "block";
}

btnToggle.addEventListener("click", () => {
  const isSettings = settingsView.style.display !== "none";
  if (isSettings) closeSettings(); else openSettings();
});

btnSaveKey.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  if (!key) { alert("API Key を入力してください"); return; }
  await chrome.storage.local.set({ apiKey: key });
  apiKey = key;
  settingsView.style.display = "none";
  mainView.style.display     = "block";
  pageAlert.innerHTML = "";
  showAlert("info", "API Key を保存しました。");
});

btnCancel.addEventListener("click", () => {
  if (!apiKey) return; // 未設定なら閉じられない
  closeSettings();
});

document.getElementById("btn-test-key").addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  const resultEl = document.getElementById("test-result");
  if (!key) { resultEl.textContent = "API Key を入力してください"; resultEl.style.color = "#c00"; return; }

  resultEl.textContent = "テスト中...";
  resultEl.style.color = "#666";
  try {
    // カード一覧は認証不要 → 接続確認
    const res = await fetch(`${API_BASE}/api/v1/cards?limit=1`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      // API Key の正否を import エンドポイント（認証必須）で確認
      const authRes = await fetch(`${API_BASE}/api/v1/import/market-results`, {
        method: "OPTIONS",
        headers: { Authorization: `Bearer ${key}` },
      });
      // OPTIONS は 204 が返れば接続OK（認証はPOST時に確認）
      resultEl.textContent = `✓ 接続OK（${data.cards?.length ?? 0} cards取得済み）`;
      resultEl.style.color = "#1b5e20";
    } else {
      resultEl.textContent = `✗ HTTP ${res.status}`;
      resultEl.style.color = "#c00";
    }
  } catch (e) {
    resultEl.textContent = `✗ ${e.message}`;
    resultEl.style.color = "#c00";
  }
});

// ── Card search ───────────────────────────────────────────────────────────────
cardSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const q = cardSearch.value.trim();
  if (q.length < 1) { renderCardList([]); return; }
  searchTimer = setTimeout(() => searchCards(q), 350);
});

async function searchCards(query) {
  cardList.innerHTML = '<div class="card-empty">検索中...</div>';
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/cards?search=${encodeURIComponent(query)}&limit=30`,
      { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${txt ? ": " + txt.slice(0, 80) : ""}`);
    }
    const data = await res.json();
    renderCardList(data.cards || []);
  } catch (err) {
    cardList.innerHTML = `<div class="card-empty" style="color:#c00">エラー: ${esc(err.message)}</div>`;
  }
}

function renderCardList(cards) {
  selectedCard = null;
  btnCollect.disabled = true;

  if (!cards.length) {
    cardList.innerHTML = '<div class="card-empty">該当なし</div>';
    return;
  }

  cardList.innerHTML = cards.map((c) => `
    <div class="card-item" data-id="${c.id}" data-name="${esc(c.name)}" data-rarity="${esc(c.rarity)}" data-set="${esc(c.setName)}">
      <div class="card-name">${esc(c.name)}</div>
      <div class="card-sub">${esc(c.rarity)} · ${esc(c.setName)}</div>
    </div>
  `).join("");

  cardList.querySelectorAll(".card-item").forEach((el) => {
    el.addEventListener("click", () => {
      cardList.querySelectorAll(".card-item").forEach((e) => e.classList.remove("active"));
      el.classList.add("active");
      selectedCard = {
        id:     el.dataset.id,
        name:   el.dataset.name,
        rarity: el.dataset.rarity,
        set:    el.dataset.set,
      };
      btnCollect.disabled = false;
      resultBox.style.display = "none";
    });
  });
}

// ── Collect ───────────────────────────────────────────────────────────────────
btnCollect.addEventListener("click", async () => {
  if (!selectedCard || !currentTab) return;
  if (!apiKey) { showAlert("warn", "API Key が未設定です。⚙ から設定してください。"); return; }

  btnCollect.disabled = true;
  btnCollect.innerHTML = '<span class="spinner"></span>収集中...';
  progressText.textContent = "ページからアイテムを取得中...";
  resultBox.style.display  = "none";

  try {
    // 1. Scrape items from Mercari page
    const [execResult] = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func:   scrapeMercariItems,
    });

    const items = execResult?.result || [];

    if (!items.length) {
      progressText.textContent = "";
      showAlert("warn", "アイテムが見つかりませんでした。ページを再読み込みして試してください。");
      btnCollect.innerHTML = "収集する";
      btnCollect.disabled  = false;
      return;
    }

    progressText.textContent = `${items.length} 件取得 → API に送信中...`;

    // 2. Send to GCI API
    const res = await fetch(`${API_BASE}/api/v1/import/market-results`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        cardId: selectedCard.id,
        source: "mercari_sold",
        items,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    // 3. Show result
    progressText.textContent = "";
    resSaved.textContent = `${data.saved} 件`;
    resAuto.textContent  = `${data.autoApproved} 件`;
    resSkip.textContent  = `${data.skipped} 件`;
    resultBox.style.display = "block";

  } catch (err) {
    progressText.textContent = "";
    showAlert("error", `エラー: ${err.message}`);
  } finally {
    btnCollect.innerHTML = "収集する";
    btnCollect.disabled  = !selectedCard;
  }
});

// ── Scraper (runs in Mercari page context) ────────────────────────────────────
function scrapeMercariItems() {
  const items = [];
  const seen  = new Set();

  // Mercari item links: href contains /item/m followed by digits
  const links = document.querySelectorAll('a[href*="/item/m"]');

  links.forEach((a) => {
    const url = a.href;
    // Only direct item pages (not search/shop links)
    if (!url.match(/\/item\/m\d+/)) return;
    if (seen.has(url)) return;
    seen.add(url);

    // Container: closest li or article
    const container = a.closest("li") || a.closest("article") || a;

    // Title: img alt is most reliable on Mercari
    const img    = container.querySelector("img");
    const title  = (img?.alt || "").trim();
    if (title.length < 3) return;

    // Price: ¥ formatted number in container text
    const text   = container.textContent || "";
    const matches = text.match(/[¥￥]([\d,]+)/g);
    if (!matches) return;

    const prices = matches
      .map((p) => parseInt(p.replace(/[¥￥,]/g, ""), 10))
      .filter((p) => p >= 100 && p <= 10_000_000);
    if (!prices.length) return;

    // Use the highest price found (usually the sold price on sold_out page)
    const price = Math.max(...prices);

    // Image URL
    const imageUrl = img?.src || undefined;

    items.push({ title, price, url, imageUrl });
  });

  return items;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showAlert(type, msg) {
  pageAlert.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
}

function esc(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
