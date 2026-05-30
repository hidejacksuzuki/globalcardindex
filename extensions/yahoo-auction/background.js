/**
 * GCI Yahoo Auction Importer — Background Service Worker
 *
 * バッチ自動収集ロジック：
 *   1. popup から "START_BATCH" メッセージを受信
 *   2. API からカード一覧を取得
 *   3. 各カードの落札検索URLに順番にナビゲート
 *   4. content.js に AUTO_SUBMIT を送信
 *   5. 完了 or エラーを受けて次のカードへ進む
 *   6. 全件終了後に popup へ通知
 */

"use strict";

// ── 状態 ─────────────────────────────────────────────────────────────────────

let batchState = {
  running:  false,
  queue:    [],   // [{ cardId, name, closedUrl }, ...]
  index:    0,
  results:  [],   // [{ cardId, name, saved, skipped, error }]
  tabId:    null,
};

// ── Popup / content との通信 ──────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_BATCH") {
    if (batchState.running) {
      sendResponse({ ok: false, error: "already running" });
      return;
    }
    startBatch(msg.apiUrl, msg.cronSecret).catch(console.error);
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "STOP_BATCH") {
    batchState.running = false;
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "BATCH_STATUS") {
    sendResponse({ ...batchState });
    return;
  }

  // content.js から: 1件の自動インポートが完了
  if (msg.type === "AUTO_SUBMIT_DONE") {
    handleAutoSubmitDone(msg);
    return;
  }
});

// ── バッチ開始 ────────────────────────────────────────────────────────────────

async function startBatch(apiUrl, cronSecret) {
  // 1. カード一覧取得
  let cards;
  try {
    const res = await fetch(`${apiUrl}/api/v1/cards?limit=500`, {
      headers: { "Authorization": `Bearer ${cronSecret}` },
    });
    const data = await res.json();
    cards = data.cards ?? data.data ?? [];
  } catch (e) {
    broadcastStatus({ error: `カード取得失敗: ${e.message}` });
    return;
  }

  if (!cards.length) {
    broadcastStatus({ error: "カードが0件です" });
    return;
  }

  // 2. キュー構築: 各カードの落札検索URLを作る
  const queue = cards.map((c) => {
    const keyword = encodeURIComponent(
      `${c.name} ${c.rarity ?? ""} ${c.setName ?? ""}`.trim()
    );
    const closedUrl = `https://auctions.yahoo.co.jp/closedsearch/closedsearch?p=${keyword}`;
    return { cardId: c.id, name: c.name, closedUrl };
  });

  batchState = {
    running: true,
    queue,
    index:   0,
    results: [],
    tabId:   null,
    apiUrl,
    cronSecret,
  };

  broadcastStatus();
  await processNext();
}

// ── 1件ずつ処理 ───────────────────────────────────────────────────────────────

async function processNext() {
  if (!batchState.running) return;

  const { queue, index } = batchState;
  if (index >= queue.length) {
    batchState.running = false;
    broadcastStatus({ done: true });
    // タブを閉じる
    if (batchState.tabId) {
      chrome.tabs.remove(batchState.tabId).catch(() => {});
    }
    return;
  }

  const item = queue[index];

  // タブを開く or 既存タブをナビゲート
  try {
    if (batchState.tabId) {
      await chrome.tabs.update(batchState.tabId, { url: item.closedUrl });
    } else {
      const tab = await chrome.tabs.create({ url: item.closedUrl, active: false });
      batchState.tabId = tab.id;
    }
  } catch (e) {
    advanceQueue({ error: e.message });
    return;
  }

  broadcastStatus();

  // ページ読み込み完了を待つ（onUpdated でキャッチ）
  // → content.js が load 後に READY を送ってくるのを待つ
  // タイムアウト: 15秒
  batchState._timeout = setTimeout(() => {
    // タイムアウト: スキップ
    advanceQueue({ error: "タイムアウト (15s)" });
  }, 15000);
}

// ── タブ更新監視: content.js が ready になったら AUTO_SUBMIT を送る ────────────

chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (!batchState.running) return;
  if (tabId !== batchState.tabId) return;
  if (info.status !== "complete") return;

  // ページ完了 → content.js に AUTO_SUBMIT を送信
  // 少し待ってからscriptが初期化されるのを待つ
  await sleep(1500);

  if (!batchState.running) return;

  const item = batchState.queue[batchState.index];
  try {
    await chrome.tabs.sendMessage(tabId, {
      type:        "AUTO_SUBMIT",
      cardId:      item.cardId,
      apiUrl:      batchState.apiUrl,
      cronSecret:  batchState.cronSecret,
    });
  } catch (e) {
    // content.js がまだ準備できていない場合など
    clearTimeout(batchState._timeout);
    advanceQueue({ error: `送信失敗: ${e.message}` });
  }
});

// ── AUTO_SUBMIT_DONE を受け取ったら次へ ───────────────────────────────────────

function handleAutoSubmitDone(msg) {
  clearTimeout(batchState._timeout);
  advanceQueue({ saved: msg.saved, skipped: msg.skipped, error: msg.error });
}

function advanceQueue(result) {
  const item = batchState.queue[batchState.index];
  batchState.results.push({
    cardId:  item.cardId,
    name:    item.name,
    saved:   result.saved   ?? 0,
    skipped: result.skipped ?? 0,
    error:   result.error   ?? null,
  });
  batchState.index++;

  broadcastStatus();

  // 次の処理（ヤフオクへの負荷を避けるため 2 秒間隔）
  setTimeout(() => processNext().catch(console.error), 2000);
}

// ── Popup へのブロードキャスト ─────────────────────────────────────────────────

function broadcastStatus(extra = {}) {
  chrome.runtime.sendMessage({
    type:     "BATCH_UPDATE",
    running:  batchState.running,
    total:    batchState.queue.length,
    index:    batchState.index,
    results:  batchState.results,
    current:  batchState.queue[batchState.index]?.name ?? null,
    ...extra,
  }).catch(() => {}); // popup が閉じているときは無視
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
