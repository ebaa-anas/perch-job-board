import type { Point } from "@/features/admin/analytics";

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
}

/** Compact SVG area chart — no chart library. */
export function AreaChart({
  points,
  label,
  accent = "var(--color-primary)",
}: {
  points: Point[];
  label: string;
  accent?: string;
}) {
  const w = 480;
  const h = 120;
  const pad = 6;
  const max = niceMax(Math.max(1, ...points.map((p) => p.value)));
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${pad + i * step} ${y(p.value)}`)
    .join(" ");
  const area = `${line} L ${pad + (points.length - 1) * step} ${h - pad} L ${pad} ${h - pad} Z`;
  const total = points.reduce((s, p) => s + p.value, 0);

  return (
    <figure className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <figcaption className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {total} in {points.length}d
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="mt-3 h-28 w-full"
        role="img"
        aria-label={`${label}: ${total} over ${points.length} days`}
      >
        <path d={area} fill={accent} fillOpacity="0.12" />
        <path d={line} fill="none" stroke={accent} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[0.65rem] text-muted-foreground">
        <span>{points[0]?.date.slice(5)}</span>
        <span>{points[points.length - 1]?.date.slice(5)}</span>
      </div>
    </figure>
  );
}

/** Horizontal bars for a small ranked list. */
export function BarList({
  items,
  label,
}: {
  items: { label: string; value: number; href?: string }[];
  label: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-sm font-medium">{label}</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.label} className="text-sm">
            <div className="flex justify-between gap-2">
              <span className="truncate">{item.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {item.value}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-sm text-muted-foreground">No data yet.</li>
        )}
      </ul>
    </div>
  );
}
