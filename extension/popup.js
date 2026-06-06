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

const API_BASE = "https://gci-data.com";

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
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    renderCardList(data.cards || []);
  } catch {
    cardList.innerHTML = '<div class="card-empty">取得エラー — API Key を確認してください</div>';
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
