import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PriorityBadge, StatusBadge } from "../../components/Badges";
import Timeline from "../../components/Timeline";
import { api } from "../../lib/api";
import { CATEGORIES, PRIORITIES, STATUSES } from "../../lib/constants";
import { formatDate } from "../../lib/format";
import { useI18n } from "../../lib/i18n";
import type { OfficerGrievance, Priority, Status } from "../../lib/types";

interface Page {
  items: OfficerGrievance[];
  total: number;
}
const PAGE = 15;

function Editor({ g, onSaved }: { g: OfficerGrievance; onSaved: (g: OfficerGrievance) => void }) {
  const { t, statusLabel, priorityLabel } = useI18n();
  const [status, setStatus] = useState<Status>(g.status);
  const [priority, setPriority] = useState<Priority>(g.priority);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const updated = await api.patch<OfficerGrievance>(`/api/officer/grievances/${g.id}`, {
        status: status !== g.status ? status : undefined,
        priority: priority !== g.priority ? priority : undefined,
        note: note.trim() || undefined,
      });
      onSaved(updated);
      setNote("");
      setMsg({ ok: true, text: t("saved") });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : t("error_generic") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-3 rounded-lg bg-paper p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="lbl" htmlFor={`st-${g.id}`}>
            {t("new_status")}
          </label>
          <select id={`st-${g.id}`} className="field" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor={`pr-${g.id}`}>
            {t("priority")}
          </label>
          <select id={`pr-${g.id}`} className="field" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {priorityLabel(p)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="lbl" htmlFor={`nt-${g.id}`}>
          {t("officer_note")}
        </label>
        <textarea id={`nt-${g.id}`} className="field min-h-20" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn btn-primary btn-small">
          {busy ? t("saving") : t("save_update")}
        </button>
        {msg && (
          <span role="status" className={msg.ok ? "font-semibold text-leaf" : "text-brick"}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}

export default function Complaints() {
  const { t, lang, categoryLabel, statusLabel, priorityLabel } = useI18n();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<OfficerGrievance[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(
    async (offset: number, append: boolean) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      if (category) params.set("category", category);
      try {
        const page = await api.get<Page>(`/api/officer/grievances?${params}`);
        setItems((prev) => (append ? [...prev, ...page.items] : page.items));
        setTotal(page.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("error_generic"));
      } finally {
        setLoading(false);
      }
    },
    [q, status, priority, category, t],
  );

  // Reload from the top whenever a filter changes (search text is debounced).
  useEffect(() => {
    const id = setTimeout(() => void load(0, false), 250);
    return () => clearTimeout(id);
  }, [load]);

  const replace = (g: OfficerGrievance) => setItems((prev) => prev.map((x) => (x.id === g.id ? g : x)));

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="lbl" htmlFor="f-q">
            {t("search")}
          </label>
          <input id="f-q" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_complaints")} />
        </div>
        <div>
          <label className="lbl" htmlFor="f-s">
            {t("filter_status")}
          </label>
          <select id="f-s" className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("all_f")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="f-p">
            {t("filter_priority")}
          </label>
          <select id="f-p" className="field" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">{t("all_f")}</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {priorityLabel(p)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="f-c">
            {t("filter_category")}
          </label>
          <select id="f-c" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t("all_f")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-[#f7dcd8] px-3 py-2 text-brick">
          {error}
        </p>
      )}
      <p className="mt-4 text-sm text-slate" aria-live="polite">
        {loading && items.length === 0 ? t("loading") : `${t("showing")} ${items.length} ${t("of")} ${total}`}
      </p>
      {!loading && items.length === 0 && !error && <p className="mt-2 text-slate">{t("no_complaints")}</p>}

      <ul className="mt-2 space-y-3">
        {items.map((g) => {
          const expanded = open === g.id;
          return (
            <li key={g.id} className="rounded-xl border border-line bg-white">
              <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : g.id)} className="flex w-full items-start gap-3 p-4 text-left">
                <span className="flex-1">
                  <span className="block font-mono text-sm font-bold tracking-wider text-slate">{g.tracking_id}</span>
                  <span className="block text-lg font-semibold">{g.title}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={g.status} />
                    <PriorityBadge priority={g.priority} />
                    <span className="text-sm text-slate">
                      {categoryLabel(g.category)} · {formatDate(g.created_at, lang, false)}
                    </span>
                  </span>
                </span>
                {expanded ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
              </button>
              {expanded && (
                <div className="space-y-5 border-t border-line p-4">
                  <dl className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <dt className="text-sm text-slate">{t("citizen")}</dt>
                      <dd className="font-semibold">{g.citizen_name}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-slate">{t("department")}</dt>
                      <dd className="font-semibold">{g.department}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-slate">{t("location")}</dt>
                      <dd className="font-semibold">{g.location ?? "–"}</dd>
                    </div>
                  </dl>
                  <div>
                    <p className="text-sm text-slate">{t("description")}</p>
                    <p className="whitespace-pre-line">{g.description}</p>
                  </div>
                  {g.ai_summary && (
                    <div>
                      <p className="text-sm text-slate">{t("summary")}</p>
                      <p>{g.ai_summary}</p>
                    </div>
                  )}
                  <Editor g={g} onSaved={replace} />
                  <Timeline events={g.events} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {items.length < total && (
        <div className="mt-5">
          <button type="button" disabled={loading} onClick={() => void load(items.length, true)} className="btn btn-quiet">
            {loading ? t("loading") : t("load_more")}
          </button>
        </div>
      )}
    </div>
  );
}
