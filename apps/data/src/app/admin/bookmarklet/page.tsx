/**
 * /admin/bookmarklet
 * Mercari ブックマークレット設置ページ
 */

import { BookmarkletCode } from "./BookmarkletClient";

export const dynamic = "force-dynamic";

export default function BookmarkletPage() {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const apiUrl     = "https://gci-data-hidejacksuzukis-projects.vercel.app";

  if (!cronSecret) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        CRON_SECRET が設定されていません。Vercel の環境変数を確認してください。
      </div>
    );
  }

  const js = `javascript:(function(){if(document.getElementById('gci-bm'))return;var API='${apiUrl}',SEC='${cronSecret}';function scrape(){var items=[],seen=new Set();var links=[].slice.call(document.querySelectorAll('a[href*="/item/m"]'));links.forEach(function(a){var url=a.href.split('?')[0];if(seen.has(url))return;seen.add(url);var thumb=a.querySelector('[aria-label]');var label=thumb?thumb.getAttribute('aria-label'):'';var tm=label.match(/^(.+)の画像/);var pm=label.match(/([0-9,]+)円/);if(!tm||!pm)return;var title=tm[1].trim();var price=parseInt(pm[1].replace(/,/g,''),10);if(title.length<5||price<100||price>10000000)return;items.push({title:title,price:price,url:url});});return items;}async function fetchCards(){try{var r=await fetch(API+'/api/v1/cards?limit=500',{headers:{'Authorization':'Bearer '+SEC}});var d=await r.json();return d.cards||[];}catch(e){return[];}}async function init(){var panel=document.createElement('div');panel.id='gci-bm';panel.style.cssText='position:fixed;bottom:20px;right:20px;z-index:999999;background:#fff;border:1px solid #ddd;border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,.15);padding:16px;width:320px;font-family:-apple-system,sans-serif;font-size:13px;color:#1a1a2e;';panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><span style="font-weight:600;">GCI (Mercari)</span><button id="gci-x" style="background:none;border:none;cursor:pointer;color:#999;font-size:16px;">✕</button></div><div style="margin-bottom:6px;"><input id="gci-filter" type="text" placeholder="カード名で絞り込み..." style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:12px;outline:none;"></div><div style="margin-bottom:10px;"><select id="gci-sel" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:12px;"><option value="">読み込み中...</option></select></div><div id="gci-cnt" style="font-size:12px;color:#666;margin-bottom:12px;"></div><button id="gci-btn" style="width:100%;padding:9px;background:#1a1a2e;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;">取り込む</button><div id="gci-msg" style="margin-top:10px;font-size:12px;text-align:center;min-height:16px;"></div>';document.body.appendChild(panel);document.getElementById('gci-x').onclick=function(){panel.remove();};var items=scrape();document.getElementById('gci-cnt').textContent='検出: '+items.length+'件';var allCards=[];var cards=await fetchCards();var sel=document.getElementById('gci-sel');function renderOptions(q){var filtered=q?allCards.filter(function(c){return(c.name+' '+c.rarity+' '+c.setName).toLowerCase().indexOf(q.toLowerCase())>=0;}):allCards;sel.innerHTML='<option value="">'+(q?filtered.length+'件絞り込み中':'カードを選択...')+'</option>'+filtered.map(function(c){return'<option value="'+c.id+'">'+c.name+' '+c.rarity+' '+c.setName+'</option>';}).join('');}if(cards.length>0){allCards=cards;renderOptions('');}else{sel.innerHTML='<option value="">カード取得失敗</option>';}document.getElementById('gci-filter').oninput=function(){renderOptions(this.value);};document.getElementById('gci-btn').onclick=async function(){var cardId=sel.value;if(!cardId){msg('カードを選択してください',1);return;}if(!items.length){msg('データが見つかりませんでした',1);return;}var btn=document.getElementById('gci-btn');btn.disabled=true;btn.textContent='送信中...';msg('');try{var r=await fetch(API+'/api/v1/import/mercari',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SEC},body:JSON.stringify({cardId:cardId,items:items})});var d=await r.json();if(d.ok){msg('✓ '+d.saved+'件取り込みました（スキップ: '+d.skipped+'）');}else{msg('エラー: '+d.error,1);}}catch(e){msg('通信エラー: '+e.message,1);}finally{btn.disabled=false;btn.textContent='取り込む';}};function msg(t,e){var el=document.getElementById('gci-msg');el.textContent=t;el.style.color=e?'#e74c3c':'#27ae60';}}init();})();`;

  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <h1 className="text-xl font-semibold text-navy">Mercari ブックマークレット</h1>
        <p className="mt-1 text-sm text-navy/60">
          Mercari の検索ページで起動して価格データを取り込みます。
        </p>
      </header>

      <div className="rounded border border-navy/10 bg-white p-6 space-y-4">
        <p className="text-sm font-medium text-navy">Step 1 — ブックマークに手動追加</p>
        <ol className="space-y-2 text-xs text-navy/70">
          <li className="flex gap-2"><span className="font-bold text-navy shrink-0">1.</span>下のコードをクリックして全選択 → コピー（⌘+A → ⌘+C）</li>
          <li className="flex gap-2"><span className="font-bold text-navy shrink-0">2.</span>ブックマークバーを右クリック →「ページを追加...」</li>
          <li className="flex gap-2"><span className="font-bold text-navy shrink-0">3.</span>名前「GCI Mercari」、URLに貼り付けて保存</li>
        </ol>
        <BookmarkletCode code={js} />
      </div>

      <div className="rounded border border-navy/10 bg-white p-6 space-y-3">
        <p className="text-sm font-medium text-navy">Step 2 — 使い方</p>
        <ol className="space-y-2 text-sm text-navy/70">
          <li className="flex gap-2">
            <span className="shrink-0 font-bold text-navy">1.</span>
            <span>Mercari で販売済み商品を検索（「売り切れ」フィルターをON）</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 font-bold text-navy">2.</span>
            <span>ブックマークバーの「GCI Mercari」をクリック</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 font-bold text-navy">3.</span>
            <span>パネルでカードを選択して「取り込む」</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 font-bold text-navy">4.</span>
            <span>gci-data の <strong>Cards → Collect</strong> で承認</span>
          </li>
        </ol>
      </div>

      <div className="rounded border border-navy/10 bg-white p-4 space-y-1">
        <p className="text-xs font-medium text-navy">設定確認</p>
        <p className="text-xs text-navy/60">API: <code className="rounded bg-navy/5 px-1">{apiUrl}</code></p>
        <p className="text-xs text-navy/60">Secret: <code className="rounded bg-navy/5 px-1">{cronSecret.slice(0, 8)}...</code></p>
      </div>
    </div>
  );
}
