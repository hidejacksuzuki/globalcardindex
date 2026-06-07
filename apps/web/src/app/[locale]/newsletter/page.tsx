import type { Metadata }    from 'next';
import { SubscribeForm }    from '@/components/newsletter/SubscribeForm';
import { getTranslations }  from '@/i18n';
import type { Locale }      from '@/i18n/config';

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const isEn = params.locale === 'en';
  return {
    title:       'Newsletter | Global Card Index',
    description: isEn
      ? 'Receive daily trading card market summaries by email. Free, cancel anytime.'
      : 'トレカ市場の日次まとめを毎朝メールでお届けします。無料・いつでも退会可能。',
  };
}

export default function NewsletterPage({ params }: { params: { locale: Locale } }) {
  const t    = getTranslations(params.locale);
  const isEn = params.locale === 'en';

  const features = isEn
    ? [
        { icon: '📊', label: 'Daily delivery', desc: '1:00 JST' },
        { icon: '🆓', label: 'Free',           desc: 'No credit card' },
        { icon: '🚪', label: 'Unsubscribe',    desc: 'One click' },
      ]
    : [
        { icon: '📊', label: '毎朝配信', desc: '1:00 JST' },
        { icon: '🆓', label: '無料',    desc: '登録不要' },
        { icon: '🚪', label: '退会自由', desc: 'ワンクリック' },
      ];

  return (
    <div className="mx-auto max-w-xl py-16">
      <div className="mb-10 text-center">
        <p className="mb-2 text-xs uppercase tracking-widest text-navy/40">Newsletter</p>
        <h1 className="text-3xl font-semibold text-navy">
          {isEn ? 'Daily TCG Market Recap' : '毎朝届くトレカ市況'}
        </h1>
        <p className="mt-4 text-navy/60 leading-relaxed">
          {isEn ? (
            <>GCI Daily Recap delivered to your inbox.<br />Top gainers, losers, volume spikes, and index moves — every morning.</>
          ) : (
            <>GCI Daily Recap をメールでお届けします。<br />高騰・暴落・出品急増・指数変動を毎朝確認。</>
          )}
        </p>
      </div>

      <div className="mb-10 grid grid-cols-3 gap-4 text-center text-sm">
        {features.map(({ icon, label, desc }) => (
          <div key={label} className="border border-navy/10 bg-white p-4">
            <p className="text-2xl">{icon}</p>
            <p className="mt-2 font-medium text-navy">{label}</p>
            <p className="text-xs text-navy/40">{desc}</p>
          </div>
        ))}
      </div>

      <SubscribeForm />

      <p className="mt-8 text-center text-xs text-navy/30 leading-relaxed">
        {isEn ? (
          <>
            A confirmation email will be sent after signup (double opt-in).<br />
            Delivery will not begin until you click the confirmation link.<br />
            Your email is used only for newsletter delivery.
          </>
        ) : (
          <>
            登録後、確認メールを送信します（ダブルオプトイン）。<br />
            確認リンクをクリックするまで配信は開始されません。<br />
            個人情報はニュースレター配信のみに使用します。
          </>
        )}
      </p>
    </div>
  );
}
