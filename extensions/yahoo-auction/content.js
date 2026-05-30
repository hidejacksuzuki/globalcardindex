/**
 * GCI Yahoo Auction Importer — Content Script
 *
 * ヤフオクの検索/落札済みページに「GCI Import」ボタンを注入し、
 * 結果をスクレイピングして gci-data API に送信する。
 */

(function () {
  "use strict";

  // ── 初期化（重複実行防止）────────────────────────────────────────────────
  if (document.getElementById("gci-import-panel")) return;

  const isClosed = location.pathname.includes("closedsearch");
  const keyword  = new URLSearchParams(location.search).get("p") ?? "";

  // ── スクレイピング ────────────────────────────────────────────────────────

  function scrapeItems() {
    const items = [];
    const seen  = new Set();

    // 落札アイテムリンク（auctions.yahoo.co.jp/jp/auction/）を起点にする
    const auctionLinks = [...document.querySelectorAll(
      "a[href*='auctions.yahoo.co.jp/jp/auction/']"
    )];
    console.log("[GCI] auction links found:", auctionLinks.length);

    // URL ごとにリンクをグループ化し、タイトルが最も長いものを選ぶ
    const urlMap = new Map();
    auctionLinks.forEach((a) => {
      const url   = a.href;
      const title = a.textContent?.trim() ?? "";
      if (!urlMap.has(url) || title.length > (urlMap.get(url).title?.length ?? 0)) {
        urlMap.set(url, { a, title });
      }
    });

    urlMap.forEach(({ a, title }, url) => {
      // タイトルが短い・数字のみは除外
      if (title.length < 5 || /^[\d,¥￥〜～\s]+$/.test(title)) return;

      // コンテナから価格を抽出（「落札X円」の X を優先）
      const container = a.closest("li") ?? a.closest("div[class]") ?? a.parentElement;
      const text      = container?.textContent ?? "";

      // 「落札」直後の数字を優先
      const rakusatsuMatch = text.match(/落札[\s:：]*([\d,]+)円/);
      let price;
      if (rakusatsuMatch) {
        price = parseInt(rakusatsuMatch[1].replace(/,/g, ""), 10);
      } else {
        // 3桁以上の数字から100〜10,000,000の範囲のものを取得
        const nums = [...text.matchAll(/[\d,]{3,}/g)]
          .map((m) => parseInt(m[0].replace(/,/g, ""), 10))
          .filter((n) => n >= 100 && n <= 10_000_000);
        if (nums.length === 0) return;
        price = Math.max(...nums);
      }

      items.push({ title, price, url });
    });

    console.log("[GCI] scraped items:", items.length);
    if (items.length > 0) console.log("[GCI] sample:", JSON.stringify(items[0]));
    return items;
  }

  /** "5月 19日 23時 12分" → ISO string */
  function parseJpDate(text) {
    try {
      const m = text.match(/(\d+)月\s*(\d+)日/);
      if (!m) return undefined;
      const year  = new Date().getFullYear();
      const month = parseInt(m[1], 10) - 1;
      const day   = parseInt(m[2], 10);
      return new Date(year, month, day).toISOString();
    } catch {
      return undefined;
    }
  }

  // ── カード選択UI ──────────────────────────────────────────────────────────

  let cards = [];

  async function fetchCards(apiUrl, cronSecret) {
    try {
      const res = await fetch(`${apiUrl}/api/v1/cards?limit=200`, {
        headers: { "Authorization": `Bearer ${cronSecret}` },
      });
      const data = await res.json();
      return data.cards ?? data.data ?? [];
    } catch {
      return [];
    }
  }

  // ── パネルUI ──────────────────────────────────────────────────────────────

  function buildPanel() {
    const panel = document.createElement("div");
    panel.id = "gci-import-panel";
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 10px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.15);
      padding: 16px;
      width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      color: #1a1a2e;
    `;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-weight:600;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">GCI Importer</span>
        <button id="gci-close" style="background:none;border:none;cursor:pointer;color:#999;font-size:16px;padding:0 4px;">✕</button>
      </div>

      <div style="font-size:11px;color:#666;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.07em;">
        ${isClosed ? "落札済みデータ" : "開催中オークション"}
      </div>
      <div style="font-size:11px;color:#999;margin-bottom:12px;word-break:break-all;">
        キーワード: ${keyword || "（なし）"}
      </div>

      <div style="margin-bottom:10px;">
        <label style="font-size:11px;color:#666;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.07em;">カード</label>
        <select id="gci-card-select" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:12px;background:#fff;">
          <option value="">読み込み中...</option>
        </select>
      </div>

      <div id="gci-count" style="font-size:12px;color:#666;margin-bottom:12px;"></div>

      <button id="gci-import-btn" style="
        width:100%;padding:9px;
        background:#1a1a2e;color:#fff;
        border:none;border-radius:6px;
        font-size:13px;font-weight:500;
        cursor:pointer;
      ">
        取り込む
      </button>

      <div id="gci-msg" style="margin-top:10px;font-size:12px;text-align:center;min-height:16px;"></div>
    `;

    document.body.appendChild(panel);

    document.getElementById("gci-close").addEventListener("click", () => {
      panel.remove();
    });

    return panel;
  }

  // ── メイン処理 ────────────────────────────────────────────────────────────

  chrome.storage.sync.get(["apiUrl", "cronSecret"], async ({ apiUrl, cronSecret }) => {
    if (!apiUrl || !cronSecret) {
      const hint = document.createElement("div");
      hint.id = "gci-import-panel";
      hint.style.cssText = `
        position:fixed;bottom:20px;right:20px;z-index:999999;
        background:#1a1a2e;color:#fff;padding:10px 14px;border-radius:8px;
        font-family:sans-serif;font-size:12px;cursor:pointer;
      `;
      hint.textContent = "GCI: 拡張の設定をしてください";
      hint.addEventListener("click", () => hint.remove());
      document.body.appendChild(hint);
      return;
    }

    const panel   = buildPanel();
    const select  = document.getElementById("gci-card-select");
    const countEl = document.getElementById("gci-count");
    const msgEl   = document.getElementById("gci-msg");
    const btn     = document.getElementById("gci-import-btn");

    cards = await fetchCards(apiUrl, cronSecret);
    if (cards.length > 0) {
      select.innerHTML = '<option value="">カードを選択...</option>' +
        cards.map((c) =>
          `<option value="${c.id}">${c.name} ${c.rarity} ${c.setName}</option>`
        ).join("");
    } else {
      select.innerHTML = '<option value="">カードを取得できませんでした</option>';
    }

    const items = scrapeItems();
    countEl.textContent = `検出: ${items.length} 件`;

    btn.addEventListener("click", async () => {
      const cardId = select.value;
      if (!cardId) { showMsg("カードを選択してください", true); return; }
      if (items.length === 0) { showMsg("データが見つかりませんでした", true); return; }

      btn.disabled = true;
      btn.textContent = "送信中...";
      showMsg("");

      try {
        const res = await fetch(`${apiUrl}/api/v1/import/yahoo-auction`, {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${cronSecret}`,
          },
          body: JSON.stringify({
            cardId,
            mode:  isClosed ? "closed" : "active",
            items,
          }),
        });

        const data = await res.json();
        if (data.ok) {
          showMsg(`✓ ${data.saved} 件を取り込みました（スキップ: ${data.skipped}）`);
        } else {
          showMsg(`エラー: ${data.error}`, true);
        }
      } catch (err) {
        showMsg("通信エラー: " + err.message, true);
      } finally {
        btn.disabled = false;
        btn.textContent = "取り込む";
      }
    });

    function showMsg(text, isError = false) {
      msgEl.textContent = text;
      msgEl.style.color = isError ? "#e74c3c" : "#27ae60";
    }
  });

  // ── AUTO_SUBMIT: background.js からの自動バッチ指示を受ける ─────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type !== "AUTO_SUBMIT") return;

    const { cardId, apiUrl, cronSecret } = msg;
    const items = scrapeItems();

    if (!items.length) {
      chrome.runtime.sendMessage({ type: "AUTO_SUBMIT_DONE", saved: 0, skipped: 0, error: "0件" });
      return;
    }

    fetch(`${apiUrl}/api/v1/import/yahoo-auction`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ cardId, mode: "closed", items }),
    })
      .then((r) => r.json())
      .then((data) => {
        // 小さなバナーを表示（邪魔にならない程度）
        showAutoStatus(data.ok
          ? `✓ ${data.saved}件 取り込み完了`
          : `エラー: ${data.error}`
        );
        chrome.runtime.sendMessage({
          type:    "AUTO_SUBMIT_DONE",
          saved:   data.saved   ?? 0,
          skipped: data.skipped ?? 0,
          error:   data.ok ? null : data.error,
        });
      })
      .catch((e) => {
        chrome.runtime.sendMessage({ type: "AUTO_SUBMIT_DONE", saved: 0, skipped: 0, error: e.message });
      });
  });

  /** バッチモード用の軽量ステータスバナー */
  function showAutoStatus(text) {
    let banner = document.getElementById("gci-auto-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "gci-auto-banner";
      banner.style.cssText = `
        position:fixed;top:12px;right:12px;z-index:999999;
        background:#1a1a2e;color:#fff;padding:8px 14px;
        border-radius:8px;font-family:sans-serif;font-size:12px;
        box-shadow:0 2px 12px rgba(0,0,0,0.2);
        transition:opacity 0.3s;
      `;
      document.body.appendChild(banner);
    }
    banner.textContent = text;
    banner.style.opacity = "1";
    setTimeout(() => { banner.style.opacity = "0"; }, 3000);
  }
})();
