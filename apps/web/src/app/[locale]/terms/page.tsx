/**
 * /terms — i18n対応版
 */

import type { Metadata }  from 'next';
import Link               from 'next/link';
import { getTranslations } from '@/i18n';
import type { Locale }    from '@/i18n/config';

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const isEn = params.locale === 'en';
  return {
    title: isEn
      ? 'Terms of Service · Disclaimer | Global Card Index'
      : '利用規約 · 免責事項 | Global Card Index',
    description: isEn
      ? 'Terms of Service and disclaimer for Global Card Index. Accounts, personal data handling, nature of price data, non-investment-advice statement, and relationship with external markets.'
      : 'Global Card Index（GCI）の利用規約と免責事項。アカウント・個人情報の取り扱い、価格データの性質、投資助言の否定、外部マーケットとの関係について。',
    robots: { index: true, follow: true },
  };
}

export default function TermsPage({ params }: { params: { locale: Locale } }) {
  const t    = getTranslations(params.locale);
  const isEn = params.locale === 'en';

  return (
    <div className="mx-auto max-w-2xl space-y-10 py-4">

      <nav className="text-xs uppercase tracking-widest text-navy/40">
        <Link href="/" className="hover:text-navy transition">Home</Link>
        <span className="mx-2">/</span>
        <span>{t.terms.title}</span>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold text-navy">
          {isEn ? 'Terms of Service · Disclaimer' : '利用規約・免責事項'}
        </h1>
        <p className="mt-2 text-sm text-navy/50">
          {isEn ? 'Last updated: July 2026' : '最終更新: 2026年7月'}
        </p>
      </header>

      {isEn ? (
        <>
          <Section title="1. Service Overview">
            <p>
              Global Card Index (the &ldquo;Service&rdquo;) is an information service that provides
              market data for trading cards. Based on transaction data collected from external
              markets, the Service provides estimated market prices (low / median / high), price
              history, and a market-wide index, along with portfolio tracking, watchlists, and
              price alert notifications for registered users.
            </p>
          </Section>

          <Section title="2. Accounts">
            <p>
              Some features (Portfolio, watchlist alerts, etc.) require an account registered with
              your email address. Sign-in links and notifications are sent to that address. You are
              responsible for keeping your email account secure. To delete your account and
              associated data, please request it via the in-service feedback function; we will
              process the deletion without undue delay.
            </p>
          </Section>

          <Section title="3. Personal Data">
            <p>The Service collects and uses the following information:</p>
            <ul className="mt-3 space-y-1.5 text-sm list-disc pl-5">
              <li>Email address — for sign-in authentication and notifications you enable (price alerts, weekly summaries). Notifications can be turned off in account settings.</li>
              <li>Data you register — portfolio entries (cards, quantities, purchase prices, memos), watchlist items, and feedback submissions. Used to provide the respective features and improve the Service.</li>
              <li>Access logs — used for security and service improvement.</li>
            </ul>
            <p className="mt-3">
              We do not sell personal data or provide it to third parties except as required by
              law. Data processing is entrusted to external providers (e.g. hosting, database, and
              email delivery services) only to the extent necessary to operate the Service.
              Aggregated, non-identifiable statistics (e.g. number of portfolio registrations per
              card) may be used and displayed within the Service.
            </p>
          </Section>

          <Section title="4. Not Investment Advice">
            <p>
              Price data, estimated market prices, index values, change rates, and market trend
              information provided by the Service{' '}
              <strong className="text-navy font-semibold">
                do not constitute investment advice or trading recommendations.
              </strong>{' '}
              Decisions to buy, sell, or trade based on this information are solely your
              responsibility. The Service is not a registered investment advisor and is not subject
              to financial instruments regulations.
            </p>
          </Section>

          <Section title="5. No Price Guarantees">
            <p>
              Price information on the Service is aggregated from external market transaction data
              for reference purposes.{' '}
              <strong className="text-navy font-semibold">
                It does not guarantee actual transaction prices.
              </strong>{' '}
              Market prices fluctuate significantly based on supply, demand, timing, and card
              condition. Listed prices may differ from actual sale prices.
            </p>
          </Section>

          <Section title="6. Nature and Limits of Data">
            <p>Each card index is assigned a confidence level (Confidence):</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="shrink-0 rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 self-start mt-0.5">HIGH</span>
                <span>10+ samples, outlier rate under 20%. Relatively reliable index value.</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 self-start mt-0.5">MED</span>
                <span>3+ samples. Useful reference but may fluctuate.</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 self-start mt-0.5">LOW / Reference</span>
                <span>Limited samples, accuracy is restricted. Use as a rough guide only.</span>
              </li>
            </ul>
            <p className="mt-3">
              The Service is currently in public beta. Data collection and calculation algorithms
              are being refined and may change without notice.
            </p>
          </Section>

          <Section title="7. Prohibited Conduct">
            <p>When using the Service, you must not:</p>
            <ul className="mt-3 space-y-1.5 text-sm list-disc pl-5">
              <li>Access the Service by unauthorized means, or interfere with its operation.</li>
              <li>Scrape, crawl, or bulk-collect data from the Service by automated means without permission.</li>
              <li>Reproduce, redistribute, or resell the Service&apos;s data or content beyond personal use without permission.</li>
              <li>Impersonate others, submit false information, or use the feedback function abusively.</li>
              <li>Violate applicable laws or infringe the rights of the operator or third parties.</li>
            </ul>
            <p className="mt-3">
              The operator may suspend or delete accounts that violate these terms.
            </p>
          </Section>

          <Section title="8. Intellectual Property">
            <p>
              The content, design, index values, and aggregated data of the Service belong to the
              operator. &ldquo;Global Card Index&rdquo; is a trademark pending. Card names, game
              titles, and related trademarks appearing on the Service belong to their respective
              rights holders; the Service is not affiliated with or endorsed by those rights
              holders.
            </p>
          </Section>

          <Section title="9. Relationship with External Markets">
            <p>
              The Service is an independent third party, not affiliated with or endorsed by any
              external marketplace. We collect data in accordance with each marketplace&apos;s
              terms of service and guidelines. Actual card purchases and sales occur only on those
              marketplace platforms.
            </p>
          </Section>

          <Section title="10. Disclaimer of Liability">
            <p>
              The operator is not liable for any damages (direct or indirect) arising from the use
              of this Service. No guarantees are made regarding the accuracy, completeness, or
              timeliness of the information. No guarantees are made regarding system availability
              or continuity.
            </p>
          </Section>

          <Section title="11. Service Changes and Termination">
            <p>
              The operator may change content, add features, revise these terms, or terminate the
              Service without prior notice. Changes may be particularly frequent during the public
              beta period. The latest version of these terms is always available on this page.
            </p>
          </Section>

          <Section title="12. Governing Law and Jurisdiction">
            <p>
              These terms are governed by the laws of Japan. Any dispute arising in connection with
              the Service shall be subject to the exclusive jurisdiction of the court having
              jurisdiction over the location of the operator, as the court of first instance.
            </p>
          </Section>
        </>
      ) : (
        <>
          <Section title="1. サービス概要">
            <p>
              Global Card Index（以下「本サービス」）は、トレーディングカードの相場情報を提供する
              情報提供サービスです。外部マーケットから収集した取引データをもとに、カードごとの
              推定相場（最安値・中央値・最高値）・価格推移・市場全体の指数を提供するほか、
              登録ユーザー向けに保有カードの管理（Portfolio）・ウォッチリスト・価格変動アラート
              等の機能を提供します。
            </p>
          </Section>

          <Section title="2. アカウント">
            <p>
              一部の機能（Portfolio・ウォッチリストのアラート等）の利用には、メールアドレスによる
              アカウント登録が必要です。ログイン用リンクや各種通知は登録されたメールアドレスに
              送信されます。メールアカウントの管理は利用者ご自身の責任で行ってください。
              アカウントおよび登録データの削除を希望する場合は、サービス内のフィードバック機能
              からお申し出ください。遅滞なく削除に対応します。
            </p>
          </Section>

          <Section title="3. 個人情報の取り扱い">
            <p>本サービスは以下の情報を取得し、次の目的で利用します：</p>
            <ul className="mt-3 space-y-1.5 text-sm list-disc pl-5">
              <li>メールアドレス — ログイン認証、および利用者が有効にした通知（価格アラート・週次まとめ等）の送信のため。通知はアカウント設定からいつでも停止できます。</li>
              <li>利用者が登録するデータ — Portfolio の登録内容（カード・枚数・取得価格・メモ）、ウォッチリスト、フィードバックの内容。各機能の提供およびサービス改善のため。</li>
              <li>アクセスログ — セキュリティ確保およびサービス改善のため。</li>
            </ul>
            <p className="mt-3">
              取得した個人情報を第三者に販売することはありません。法令に基づく場合を除き、
              第三者への提供も行いません。サービス運営に必要な範囲で、ホスティング・データベース・
              メール配信等の外部事業者に取り扱いを委託することがあります。個人を特定できない
              形に集計した統計情報（例：カードごとの登録者数）は、サービス内での表示等に
              利用することがあります。
            </p>
          </Section>

          <Section title="4. 投資助言ではありません">
            <p>
              本サービスが提供する価格データ・推定相場・指数値・変動率・市場動向情報は、
              <strong className="text-navy font-semibold">投資助言・売買推奨を構成するものではありません。</strong>
              掲載情報を参考にした取引・売買等の判断は利用者ご自身の責任において行ってください。
              本サービスは投資助言業者ではなく、金融商品取引法上の規制を受けるサービスでもありません。
            </p>
          </Section>

          <Section title="5. 価格保証について">
            <p>
              本サービスに掲載される価格情報は、外部マーケットの取引データを参考集計したものです。
              <strong className="text-navy font-semibold">実際の取引価格を保証するものではありません。</strong>
              市場価格は需給・タイミング・カード状態等により大きく変動します。
              掲載価格と実際の売買価格が異なる場合があります。
            </p>
          </Section>

          <Section title="6. データの性質と限界">
            <p>各カードの指数値には「信頼度（Confidence）」を付与しています：</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="shrink-0 rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 self-start mt-0.5">HIGH</span>
                <span>サンプル10件以上・外れ値率20%未満。比較的信頼できる指数値。</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 self-start mt-0.5">MED</span>
                <span>サンプル3件以上。参考として有効ですが変動に注意。</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 self-start mt-0.5">LOW / 参考値</span>
                <span>サンプルが少なく精度が限定的。目安として参照してください。</span>
              </li>
            </ul>
            <p className="mt-3">
              サービスは現在パブリックベータ段階です。データ収集・集計アルゴリズムは改善中であり、
              予告なく変更される場合があります。
            </p>
          </Section>

          <Section title="7. 禁止事項">
            <p>本サービスの利用にあたり、以下の行為を禁止します：</p>
            <ul className="mt-3 space-y-1.5 text-sm list-disc pl-5">
              <li>不正な手段によるアクセス、サービスの運営を妨害する行為</li>
              <li>許可のないスクレイピング・クローリング等、自動化された手段による大量のデータ収集</li>
              <li>本サービスのデータ・コンテンツを私的利用の範囲を超えて無断で複製・再配布・転売する行為</li>
              <li>他者へのなりすまし、虚偽情報の登録、フィードバック機能の濫用</li>
              <li>法令に違反する行為、運営者または第三者の権利を侵害する行為</li>
            </ul>
            <p className="mt-3">
              違反があった場合、運営者はアカウントの停止・削除等の措置を行うことがあります。
            </p>
          </Section>

          <Section title="8. 知的財産">
            <p>
              本サービスのコンテンツ・デザイン・指数値・集計データに関する権利は運営者に帰属します。
              「Global Card Index」は商標出願中です。本サービスに表示されるカード名・ゲームタイトル・
              関連する商標は各権利者に帰属し、本サービスはこれらの権利者との提携・公認関係にありません。
            </p>
          </Section>

          <Section title="9. 外部マーケットとの関係">
            <p>
              本サービスは外部マーケットとは独立した第三者サービスです。
              各マーケットの利用規約・ガイドラインに従いデータを収集していますが、
              外部マーケット事業者との提携・公認関係はありません。
              カードの実際の購入・売却は各マーケットサービス上でのみ行われます。
            </p>
          </Section>

          <Section title="10. 免責事項">
            <p>
              本サービスの利用により生じたいかなる損害（直接的・間接的を問わず）についても、
              運営者は責任を負いかねます。情報の正確性・完全性・最新性について保証を行いません。
              システムの可用性・継続性についても保証を行いません。
            </p>
          </Section>

          <Section title="11. サービスの変更・停止">
            <p>
              運営者は事前の告知なく本サービスの内容変更・機能追加・本規約の改定・サービスの停止を
              行うことがあります。パブリックベータ期間中は特に変更が頻繁に行われる場合があります。
              本規約の最新版は常に本ページに掲載します。
            </p>
          </Section>

          <Section title="12. 準拠法・管轄">
            <p>
              本規約は日本法に準拠します。本サービスに関して紛争が生じた場合、
              運営者所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          </Section>
        </>
      )}

      <div className="border-t border-navy/10 pt-6 text-xs text-navy/40">
        {isEn ? (
          <>For inquiries, please use the feedback function within the service or visit{' '}
          <Link href="/" className="underline hover:text-navy/60">the homepage</Link>.</>
        ) : (
          <>ご不明な点はサービス内のフィードバック機能または{' '}
          <Link href="/" className="underline hover:text-navy/60">トップページ</Link>{' '}
          よりお問い合わせください。</>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-navy">{title}</h2>
      <div className="text-sm text-navy/70 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
