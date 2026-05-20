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

    // ── セレクター候補を順番に試す ──────────────────────────────────────────
    const ITEM_SELECTORS = [
      "li.Product",
      "li[class*='Product']",
      "[class*='sc-'] li",
      "ul[class*='list'] li",
      "div[class*='item']",
      "[data-auction-id]",
      "article",
    ];

    let rows = [];
    for (const sel of ITEM_SELECTORS) {
      rows = [...document.querySelectorAll(sel)];
      if (rows.length > 0) {
        console.log("[GCI] selector matched:", sel, "→", rows.length, "rows");
        break;
      }
    }

    // セレクターで見つからない場合はリンクから推測
    if (rows.length === 0) {
      console.log("[GCI] fallback: scanning all links");
      const links = [...document.querySelectorAll("a[href*='page.auctions.yahoo'], a[href*='/auction/']")];
      links.forEach((a) => {
        const title = a.textContent?.trim();
        // リンクの近くにある価格テキストを探す
        const parent = a.closest("li, div, tr") ?? a.parentElement;
        if (!parent) return;
        const priceMatch = parent.textContent?.match(/[\d,]{3,}/g);
        const price = priceMatch
          ? parseInt(priceMatch[priceMatch.length - 1].replace(/,/g, ""), 10)
          : null;
        if (!title || !price || title.length < 3) return;
        items.push({ title, price, url: a.href });
      });
      return items;
    }

    // ── 各行からデータを抽出 ──────────────────────────────────────────────
    rows.forEach((row) => {
      // タイトル
      const titleEl = row.querySelector(
        "h3, h2, .Product__title, [class*='Title'], [class*='title'], a[class*='title']"
      ) ?? row.querySelector("a");
      const title = titleEl?.textContent?.trim();

      // リンク
      const linkEl = row.querySelector("a[href*='auctions.yahoo'], a[href*='/auction/']")
                  ?? row.querySelector("a");

      // 価格（数字3桁以上を含むテキストを探す）
      const priceEl = row.querySelector(
        ".Product__price, [class*='Price'], [class*='price'], .u-txb, strong"
      );
      const priceText = (priceEl?.textContent ?? row.textContent ?? "")
        .match(/[\d,]{3,}/g);
      const price = priceText
        ? parseInt(priceText[priceText.length - 1].replace(/,/g, ""), 10)
        : null;

      if (!title || !price || title.length < 3 || price < 100) return;

      // 入札数
      const bidEl = row.querySelector("[class*='bid'], [class*='Bid'], [class*='count']");
      const bidText = bidEl?.textContent?.replace(/[^0-9]/g, "");
      const bidCount = bidText ? parseInt(bidText, 10) : undefined;

      // 終了日
      const dateEl = row.querySelector("[class*='Time'], [class*='time'], [class*='date'], time");
      const endedAt = dateEl?.textContent?.trim()
        ? parseJpDate(dateEl.textContent.trim())
        : undefined;

      items.push({ title, price, url: linkEl?.href, bidCount, endedAt });
    });

    console.log("[GCI] scraped items:", items.length);
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

    // 閉じるボタン
    document.getElementById("gci-close").addEventListener("click", () => {
      panel.remove();
    });

    return panel;
  }

  // ── メイン処理 ────────────────────────────────────────────────────────────

  chrome.storage.sync.get(["apiUrl", "cronSecret"], async ({ apiUrl, cronSecret }) => {
    if (!apiUrl || !cronSecret) {
      // 設定未完了 → 小さなヒントだけ表示
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

    // カード一覧を取得
    cards = await fetchCards(apiUrl, cronSecret);
    if (cards.length > 0) {
      select.innerHTML = '<option value="">カードを選択...</option>' +
        cards.map((c) =>
          `<option value="${c.id}">${c.name} ${c.rarity} ${c.setName}</option>`
        ).join("");
    } else {
      select.innerHTML = '<option value="">カードを取得できませんでした</option>';
    }

    // スクレイプ結果をプレビュー
    const items = scrapeItems();
    countEl.textContent = `検出: ${items.length} 件`;

    // 取り込みボタン
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
})();
