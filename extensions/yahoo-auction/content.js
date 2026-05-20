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

    // 落札済みページ
    if (isClosed) {
      // 落札済み検索結果の各行
      const rows = document.querySelectorAll(
        "div.Products__list li.Product, " +          // 旧UI
        "li[class*='Product'], " +                   // 新UI候補
        "div[class*='sc-'] li[class*='Product']"     // 動的クラス
      );

      rows.forEach((row) => {
        const titleEl  = row.querySelector("h3, .Product__title, [class*='Title']");
        const priceEl  = row.querySelector(".Product__price, .u-txb, [class*='Price']");
        const bidEl    = row.querySelector(".Product__bid, [class*='bid'], [class*='Bid']");
        const dateEl   = row.querySelector(".Product__time, [class*='endDate'], [class*='Time']");
        const linkEl   = row.querySelector("a[href*='page.auctions']");

        const title = titleEl?.textContent?.trim();
        const priceText = priceEl?.textContent?.replace(/[^0-9]/g, "");
        const price = priceText ? parseInt(priceText, 10) : null;

        if (!title || !price) return;

        const bidText  = bidEl?.textContent?.replace(/[^0-9]/g, "");
        const bidCount = bidText ? parseInt(bidText, 10) : undefined;
        const endedAt  = dateEl?.textContent?.trim()
          ? parseJpDate(dateEl.textContent.trim())
          : undefined;

        items.push({
          title,
          price,
          url:      linkEl?.href,
          bidCount,
          endedAt,
        });
      });

      // フォールバック：テーブル形式
      if (items.length === 0) {
        document.querySelectorAll("table.list1 tr").forEach((tr) => {
          const cells = tr.querySelectorAll("td");
          if (cells.length < 3) return;
          const titleEl = cells[0]?.querySelector("a");
          const title   = titleEl?.textContent?.trim();
          const price   = parseInt((cells[2]?.textContent ?? "").replace(/[^0-9]/g, ""), 10);
          if (!title || !price) return;
          items.push({ title, price, url: titleEl?.href });
        });
      }

    } else {
      // 開催中オークション
      document.querySelectorAll(
        "li.Product, li[class*='Product'], [class*='sc-'] li"
      ).forEach((row) => {
        const titleEl = row.querySelector("h3, .Product__title, [class*='Title']");
        const priceEl = row.querySelector(".Product__price, [class*='Price']");
        const bidEl   = row.querySelector("[class*='bid'], [class*='Bid']");
        const linkEl  = row.querySelector("a");

        const title = titleEl?.textContent?.trim();
        const priceText = priceEl?.textContent?.replace(/[^0-9]/g, "");
        const price = priceText ? parseInt(priceText, 10) : null;

        if (!title || !price) return;

        const bidText  = bidEl?.textContent?.replace(/[^0-9]/g, "");
        const bidCount = bidText ? parseInt(bidText, 10) : undefined;

        items.push({ title, price, url: linkEl?.href, bidCount });
      });
    }

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
