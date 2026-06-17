/**
 * GCI eBay Collector — Content Script
 *
 * eBay検索結果ページの sold listings を解析し、popup.js からのメッセージに応じて返す。
 * メッセージ: { type: "GCI_SCRAPE" }
 * レスポンス: { ok: true, listings: EbayListing[], pageTitle: string }
 */

(function () {
  "use strict";

  /** @param {string} text */
  function parseCurrencyAndAmount(text) {
    if (!text) return { currency: "USD", amount: 0 };
    const clean = text.replace(/,/g, "").trim();
    // "US $24.99" / "C $24.99" / "AU $24.99" / "$24.99" / "£24.99" / "¥2,400"
    const m = clean.match(/([A-Z]{1,3}\s*)?\$?([\d.]+)/);
    if (!m) return { currency: "USD", amount: 0 };
    const amount = parseFloat(m[2] ?? "0");
    let currency = "USD";
    if (clean.includes("C $") || clean.includes("CA$")) currency = "CAD";
    else if (clean.includes("AU $") || clean.includes("A$")) currency = "AUD";
    else if (clean.includes("£"))   currency = "GBP";
    else if (clean.includes("€"))   currency = "EUR";
    else if (clean.includes("¥"))   currency = "JPY";
    return { currency, amount };
  }

  /** @param {string} text */
  function parseShipping(text) {
    if (!text) return 0;
    const lc = text.toLowerCase();
    if (lc.includes("free")) return 0;
    const m = text.replace(/,/g, "").match(/([\d.]+)/);
    return m ? parseFloat(m[1] ?? "0") : 0;
  }

  /**
   * "Sold  Jun 10, 2026" → ISO8601 string
   * @param {string} text
   * @returns {string|null}
   */
  function parseSoldDate(text) {
    if (!text) return null;
    const clean = text.replace(/^Sold\s*/i, "").trim();
    const d = new Date(clean);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function scrapeListings() {
    const items = document.querySelectorAll(".s-item");
    const results = [];

    for (const item of items) {
      // eBay は先頭に "Shop on eBay" のダミー item を入れることがある
      const titleEl = item.querySelector(".s-item__title");
      const title   = titleEl?.textContent?.trim() ?? "";
      if (!title || title.toLowerCase().includes("shop on ebay")) continue;

      // URL
      const linkEl = item.querySelector(".s-item__link");
      const rawUrl = linkEl instanceof HTMLAnchorElement ? linkEl.href : null;
      // eBay URL から余分なパラメータを除去してクリーン化
      let listingUrl = null;
      if (rawUrl) {
        try {
          const u = new URL(rawUrl);
          listingUrl = `${u.origin}${u.pathname}`;
        } catch {
          listingUrl = rawUrl;
        }
      }

      // Image
      const imgEl = item.querySelector(".s-item__image-img");
      const imageUrl = imgEl instanceof HTMLImageElement ? (imgEl.src || imgEl.dataset["src"] || null) : null;

      // Price
      const priceEl = item.querySelector(".s-item__price");
      const priceText = priceEl?.textContent?.trim() ?? "";
      const { currency, amount: price } = parseCurrencyAndAmount(priceText);

      // Shipping
      const shippingEl =
        item.querySelector(".s-item__shipping") ??
        item.querySelector(".s-item__logisticsCost");
      const shipping = parseShipping(shippingEl?.textContent ?? "");

      const totalPrice = price + shipping;

      // Sold date — spans with class "POSITIVE" or "s-item__sold-date"
      let soldAt = null;
      const soldEls = item.querySelectorAll(".POSITIVE, .s-item__sold-date");
      for (const el of soldEls) {
        const t = el.textContent?.trim() ?? "";
        if (/sold/i.test(t)) {
          soldAt = parseSoldDate(t);
          break;
        }
      }

      if (price <= 0) continue;

      results.push({ title, price, shipping, totalPrice, currency, soldAt, listingUrl, imageUrl });
    }

    return results;
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (msg?.type !== "GCI_SCRAPE") return;
    try {
      const listings = scrapeListings();
      sendResponse({ ok: true, listings, pageTitle: document.title });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return true; // keep channel open for async
  });
})();
