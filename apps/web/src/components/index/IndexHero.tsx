import { formatDateTime } from '@gci/core';
import type { IndexSnapshot } from '@gci/core';
import { getTranslations } from '@/i18n';
import type { Locale }     from '@/i18n/config';

type Props = {
  snapshot:       IndexSnapshot | null;
  series?:        number[];
  dayChangeRate?: number | null;
  locale?:        Locale;
};

const DEMO_SERIES = [
  998, 1002, 1006, 1010, 1015, 1014, 1020, 1024, 1030, 1028,
  1035, 1042, 1048, 1055, 1060, 1058, 1065, 1072, 1080, 1085,
];

export function IndexHero({ snapshot, series, dayChangeRate, locale = 'ja' }: Props) {
  const t    = getTranslations(locale);
  const hero = t.indexHero;

  if (!snapshot) {
    return (
      <section className="border border-navy/10 bg-white p-10">
        <p className="text-xs uppercase tracking-widest text-navy/50">{hero.label}</p>
        <p className="mt-4 text-3xl text-navy/40">{hero.noData}</p>
        <p className="mt-2 text-sm text-navy/40">{hero.noDataHint}</p>
      </section>
    );
  }

  const data   = series && series.length > 1 ? series : DEMO_SERIES;
  const isDemo = !series || series.length <= 1;
  const prevRate = snapshot.changeRate;
  const dayRate  = dayChangeRate ?? null;

  return (
    <section className="border border-navy/10 bg-white p-10">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">

        {/* Left: numbers */}
        <div>
          <p className="text-xs uppercase tracking-widest text-navy/50">{hero.label}</p>

          <div className="mt-4 flex items-baseline gap-6">
            <p className="text-5xl font-semibold tabular-nums text-navy">
              {snapshot.value.toFixed(2)}
            </p>
            <ChangeRate label={hero.prev} rate={prevRate} />
            {dayRate !== null && <ChangeRate label={hero.h24} rate={dayRate} />}
          </div>

          <p className="mt-3 text-xs text-navy/50">
            {hero.lastUpdated} {formatDateTime(snapshot.calculatedAt, locale)}
          </p>
        </div>

        {/* Right: sparkline */}
        <div className="lg:w-96">
          <Sparkline data={data} />
          {isDemo && (
            <p className="mt-2 text-right text-[10px] uppercase tracking-widest text-navy/30">
              {hero.awaiting}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function ChangeRate({ label, rate }: { label: string; rate: number }) {
  const positive = rate >= 0;
  return (
    <span className="flex flex-col items-start">
      <span className="text-[10px] uppercase tracking-widest text-navy/40">{label}</span>
      <span className={`text-lg tabular-nums ${positive ? 'text-gold-700' : 'text-red-700'}`}>
        {positive ? '+' : ''}{rate.toFixed(2)}%
      </span>
    </span>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const width  = 320;
  const height = 80;
  const min    = Math.min(...data);
  const max    = Math.max(...data);
  const range  = max - min || 1;
  const dx     = width / (data.length - 1);

  const points  = data.map((v, i) => {
    const x = i * dx;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const linePath = `M${points.join(' L')}`;
  const areaPath = `${linePath} L${width.toFixed(2)},${height.toFixed(2)} L0,${height.toFixed(2)} Z`;
  const trending  = data[data.length - 1] >= data[0];
  const stroke    = trending ? '#C9A14A' : '#ef4444';
  const gradId    = `gci-spark-${trending ? 'up' : 'dn'}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-20 w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor={stroke} stopOpacity="0.2" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
