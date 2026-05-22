/**
 * /admin/bookmarklet
 * Mercari ブックマークレット設置ページ
 */

import { prisma } from "@gci/db";

export const dynamic = "force-dynamic";

export default async function BookmarkletPage() {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const apiUrl     = process.env.NEXT_PUBLIC_DATA_URL ?? "https://gci-data.com";

  // カード件数確認
  const cardCount = await prisma.card.count();

  // ブックマークレット JS（minified）
  const js = `(function(){
if(document.getElementById('gci-bm'))return;
var API='${apiUrl}',SEC='${cronSecret}';
function scrape(){
  var items=[],urlMap=new Map();
  var links=[].slice.call(document.querySelectorAll('a[href*="/item/m"]'));
  links.forEach(function(a){
    var url=a.href.split('?')[0];
    var title=(a.getAttribute('aria-label')||a.textContent||'').trim();
    if(!urlMap.has(url)||title.length>(urlMap.get(url).title||'').length)urlMap.set(url,{a:a,title:title});
  });
  urlMap.forEach(function(v,url){
    var title=v.title;
    if(title.length<5)return;
    var cont=v.a.closest('li')||v.a.parentElement;
    var text=cont?cont.textContent:'';
    var m=text.match(/[¥￥]([\d,]+)/);
    if(!m)return;
    var price=parseInt(m[1].replace(/,/g,''),10);
    if(price<100||price>10000000)return;
    items.push({title:title,price:price,url:url});
  });
  return items;
}
async function fetchCards(){
  try{
    var r=await fetch(API+'/api/v1/cards?limit=500',{headers:{'Authorization':'Bearer '+SEC}});
    var d=await r.json();
    return d.cards||[];
  }catch(e){return[];}
}
async function init(){
  var panel=document.createElement('div');
  panel.id='gci-bm';
  panel.style.cssText='position:fixed;bottom:20px;right:20px;z-index:999999;background:#fff;border:1px solid #ddd;border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,.15);padding:16px;width:300px;font-family:-apple-system,sans-serif;font-size:13px;color:#1a1a2e;';
  panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><span style="font-weight:600;">GCI (Mercari)</span><button id="gci-x" style="background:none;border:none;cursor:pointer;color:#999;font-size:16px;">✕</button></div><div style="margin-bottom:10px;"><select id="gci-sel" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:12px;"><option value="">読み込み中...</option></select></div><div id="gci-cnt" style="font-size:12px;color:#666;margin-bottom:12px;"></div><button id="gci-btn" style="width:100%;padding:9px;background:#1a1a2e;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;">取り込む</button><div id="gci-msg" style="margin-top:10px;font-size:12px;text-align:center;min-height:16px;"></div>';
  document.body.appendChild(panel);
  document.getElementById('gci-x').onclick=function(){panel.remove();};
  var items=scrape();
  document.getElementById('gci-cnt').textContent='検出: '+items.length+'件';
  var cards=await fetchCards();
  var sel=document.getElementById('gci-sel');
  if(cards.length>0){
    sel.innerHTML='<option value="">カードを選択...</option>'+cards.map(function(c){return'<option value="'+c.id+'">'+c.name+' '+c.rarity+' '+c.setName+'</option>';}).join('');
  }else{
    sel.innerHTML='<option value="">カード取得失敗</option>';
  }
  document.getElementById('gci-btn').onclick=async function(){
    var cardId=sel.value;
    if(!cardId){msg('カードを選択してください',1);return;}
    if(!items.length){msg('データが見つかりませんでした',1);return;}
    var btn=document.getElementById('gci-btn');
    btn.disabled=true;btn.textContent='送信中...';msg('');
    try{
      var r=await fetch(API+'/api/v1/import/mercari',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SEC},body:JSON.stringify({cardId:cardId,items:items})});
      var d=await r.json();
      if(d.ok){msg('✓ '+d.saved+'件取り込みました（スキップ: '+d.skipped+'）');}
      else{msg('エラー: '+d.error,1);}
    }catch(e){msg('通信エラー: '+e.message,1);}
    finally{btn.disabled=false;btn.textContent='取り込む';}
  };
  function msg(t,e){var el=document.getElementById('gci-msg');el.textContent=t;el.style.color=e?'#e74c3c':'#27ae60';}
}
init();
})();`;

  const bookmarkletHref = `javascript:${encodeURIComponent(js)}`;

  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <h1 className="text-xl font-semibold text-navy">Mercari ブックマークレット</h1>
        <p className="mt-1 text-sm text-navy/60">
          Mercari の検索ページで起動して価格データを取り込みます。
        </p>
      </header>

      <div className="rounded border border-navy/10 bg-white p-6 space-y-4">
        <p className="text-sm font-medium text-navy">Step 1 — ブックマークに追加</p>
        <p className="text-xs text-navy/60">
          下のボタンをブラウザの<strong>ブックマークバーにドラッグ</strong>してください。
        </p>
        <a
          href={bookmarkletHref}
          className="inline-block rounded bg-navy px-6 py-3 text-sm font-semibold text-white cursor-grab active:cursor-grabbing select-none"
          onClick={(e) => e.preventDefault()}
          draggable
        >
          🔖 GCI Mercari Importer
        </a>
        <p className="text-xs text-navy/40">
          ※ クリックしても動作しません。ドラッグしてブックマークバーに追加してください。
        </p>
      </div>

      <div className="rounded border border-navy/10 bg-white p-6 space-y-3">
        <p className="text-sm font-medium text-navy">Step 2 — 使い方</p>
        <ol className="space-y-2 text-sm text-navy/70">
          <li className="flex gap-2">
            <span className="shrink-0 font-bold text-navy">1.</span>
            <span>
              Mercari で販売済み商品を検索する
              （例：<code className="rounded bg-navy/5 px-1">ナンジャモ SR</code> を検索 → 「売り切れ」フィルター）
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 font-bold text-navy">2.</span>
            <span>ブックマークバーの「GCI Mercari Importer」をクリック</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 font-bold text-navy">3.</span>
            <span>パネルが表示されたらカードを選択して「取り込む」</span>
          </li>
        </ol>
      </div>

      <div className="rounded border border-navy/10 bg-white p-6 space-y-2">
        <p className="text-sm font-medium text-navy">ステータス</p>
        <p className="text-xs text-navy/60">カード数: <strong>{cardCount}</strong> 件登録済み</p>
        <p className="text-xs text-navy/60">API: <code className="rounded bg-navy/5 px-1">{apiUrl}</code></p>
        <p className="text-xs text-navy/60">Secret: <code className="rounded bg-navy/5 px-1">{cronSecret ? `${cronSecret.slice(0, 8)}...` : "未設定"}</code></p>
      </div>
    </div>
  );
}
