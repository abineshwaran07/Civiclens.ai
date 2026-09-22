import { Search } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { PriorityBadge, StatusBadge } from "../components/Badges";
import Timeline from "../components/Timeline";
import { ApiError, api } from "../lib/api";
import { formatDate } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { Tracked } from "../lib/types";

export default function Track() {
  const { t, lang, categoryLabel } = useI18n();
  const [params, setParams] = useSearchParams();
  const [id, setId] = useState(params.get("id") ?? "");
  const [result, setResult] = useState<Tracked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const auto = useRef(false);

  const lookup = async (raw: string) => {
    const tid = raw.trim().toUpperCase();
    if (!tid) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.get<Tracked>(`/api/grievances/track/${encodeURIComponent(tid)}`));
      setParams({ id: tid }, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? t("not_found") : e instanceof Error ? e.message : t("error_generic"));
    } finally {
      setBusy(false);
    }
  };

  // A tracking ID in the link (?id=...) is looked up once on arrival.
  useEffect(() => {
    const q = params.get("id");
    if (q && !auto.current) {
      auto.current = true;
      void lookup(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void lookup(id);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("track_title")}</h1>
      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input
          className="field flex-1 font-mono uppercase"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder={t("track_placeholder")}
          aria-label={t("tracking_id")}
          autoCapitalize="characters"
          spellCheck={false}
        />
        <button type="submit" disabled={busy || !id.trim()} className="btn btn-primary">
          <Search size={18} aria-hidden /> {busy ? t("loading") : t("track_button")}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-[#f7dcd8] px-3 py-2 text-brick">
          {error}
        </p>
      )}

      {result && (
        <section className="mt-6 rounded-xl border border-line bg-white p-5" aria-live="polite">
          <p className="font-mono text-sm font-bold tracking-wider text-slate">{result.tracking_id}</p>
          <h2 className="mt-1 text-xl font-bold">{result.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={result.status} />
            <PriorityBadge priority={result.priority} />
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate">{t("category")}</dt>
              <dd className="font-semibold">{categoryLabel(result.category)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate">{t("department")}</dt>
              <dd className="font-semibold">{result.department}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate">{t("filed_on")}</dt>
              <dd>{formatDate(result.created_at, lang)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate">{t("updated")}</dt>
              <dd>{formatDate(result.updated_at, lang)}</dd>
            </div>
          </dl>
          <div className="mt-6">
            <Timeline events={result.events} />
          </div>
        </section>
      )}
    </div>
  );
}
