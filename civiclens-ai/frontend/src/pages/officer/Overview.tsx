import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../../lib/api";
import { PRIORITIES } from "../../lib/constants";
import { useI18n } from "../../lib/i18n";
import type { Stats } from "../../lib/types";

const INK = "#1b2559";
const LEAF = "#1c7d5a";
const TURMERIC = "#f0b400";
const LINE = "#dfe3f0";

function Kpi({ label, value, hint, tone = "text-ink" }: { label: string; value: string | number; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-sm text-slate">{label}</p>
      <p className={`mt-1 font-display text-3xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate">{hint}</p>}
    </div>
  );
}

export default function Overview() {
  const { t, lang, categoryLabel, priorityLabel } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Stats>("/api/officer/stats")
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : t("error_generic")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p role="alert" className="rounded-md bg-[#f7dcd8] px-3 py-2 text-brick">{error}</p>;
  if (!stats) return <p className="text-slate">{t("loading")}</p>;

  const avg =
    stats.avg_resolution_hours == null
      ? "–"
      : stats.avg_resolution_hours >= 48
        ? `${(stats.avg_resolution_hours / 24).toFixed(1)} ${t("days")}`
        : `${stats.avg_resolution_hours.toFixed(1)} ${t("hours")}`;

  const trend = stats.trend.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(lang === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short" }),
  }));
  const categories = stats.by_category.map((c) => ({ ...c, label: categoryLabel(c.name) }));
  const maxPriority = Math.max(1, ...PRIORITIES.map((p) => stats.by_priority[p] ?? 0));
  const priorityColor = { low: "#8d95b8", medium: TURMERIC, high: "#d9772b", urgent: "#b93a2b" } as const;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label={t("kpi_total")} value={stats.total} />
        <Kpi label={t("kpi_open")} value={stats.open} />
        <Kpi label={t("kpi_resolved")} value={stats.resolved} tone="text-leaf" />
        <Kpi label={t("kpi_overdue")} value={stats.overdue} hint={t("kpi_overdue_hint")} tone={stats.overdue > 0 ? "text-brick" : "text-ink"} />
        <Kpi label={t("kpi_avg")} value={avg} />
      </div>

      <section className="rounded-xl border border-line bg-white p-4" aria-label={t("chart_trend")}>
        <h2 className="text-lg font-bold">{t("chart_trend")}</h2>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
              <CartesianGrid stroke={LINE} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="new" name={t("series_new")} stroke={INK} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="resolved" name={t("series_resolved")} stroke={LEAF} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-line bg-white p-4 lg:col-span-2" aria-label={t("chart_category")}>
          <h2 className="text-lg font-bold">{t("chart_category")}</h2>
          <div className="mt-3" style={{ height: Math.max(220, categories.length * 34) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categories} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={LINE} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name={t("kpi_total")} fill={INK} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-white p-4" aria-label={t("chart_priority")}>
          <h2 className="text-lg font-bold">{t("chart_priority")}</h2>
          <ul className="mt-4 space-y-4">
            {PRIORITIES.map((p) => {
              const n = stats.by_priority[p] ?? 0;
              return (
                <li key={p}>
                  <div className="flex justify-between text-sm font-semibold">
                    <span>{priorityLabel(p)}</span>
                    <span>{n}</span>
                  </div>
                  <div className="mt-1 h-3 rounded-full bg-line">
                    <div className="h-3 rounded-full" style={{ width: `${(n / maxPriority) * 100}%`, background: priorityColor[p] }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
