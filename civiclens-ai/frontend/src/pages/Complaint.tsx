import { Check, Copy, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PriorityBadge } from "../components/Badges";
import MicButton from "../components/MicButton";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { detectLang } from "../lib/speech";
import type { Analysis, Grievance } from "../lib/types";

export default function Complaint() {
  const { t, lang, categoryLabel } = useI18n();
  const { user, ready } = useAuth();

  const [text, setText] = useState("");
  const [location, setLocation] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Grievance | null>(null);
  const [copied, setCopied] = useState(false);

  if (!ready) return <p className="mx-auto max-w-2xl px-4 py-10 text-slate">{t("loading")}</p>;

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold">{t("login_to_file")}</h1>
        <p className="mt-2 text-slate">{t("login_to_file_p")}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/login" state={{ from: "/complaint" }} className="btn btn-primary">
            {t("login")}
          </Link>
          <Link to="/register" state={{ from: "/complaint" }} className="btn btn-quiet">
            {t("register")}
          </Link>
        </div>
      </div>
    );
  }

  const complaintLang = detectLang(text) === "ta" ? "ta" : lang;

  const analyze = async () => {
    setBusy(true);
    setError(null);
    try {
      const a = await api.post<Analysis>("/api/grievances/analyze", { text: text.trim(), language: complaintLang });
      setAnalysis(a);
      setTitle(a.title);
      setDraft(a.draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error_generic"));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!analysis) return;
    setBusy(true);
    setError(null);
    try {
      const g = await api.post<Grievance>("/api/grievances", {
        description: text.trim(),
        location: location.trim() || null,
        language: complaintLang,
        title: title.trim() || analysis.title,
        category: analysis.category,
        priority: analysis.priority,
        ai_summary: analysis.summary,
        ai_draft: draft,
      });
      setDone(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error_generic"));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setText("");
    setLocation("");
    setAnalysis(null);
    setDone(null);
    setError(null);
  };

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-xl border-2 border-leaf bg-white p-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-leaf">
            <Check size={26} aria-hidden /> {t("submitted_title")}
          </h1>
          <p className="mt-2 text-slate">{t("submitted_p")}</p>
          <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate">{t("tracking_id")}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <span className="rounded-lg bg-turmeric-soft px-4 py-2 font-mono text-2xl font-bold tracking-wider">{done.tracking_id}</span>
            <button type="button" onClick={() => void copyId(done.tracking_id)} className="btn btn-quiet btn-small">
              <Copy size={16} aria-hidden /> {copied ? t("copied") : t("copy")}
            </button>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate">{t("category")}</dt>
              <dd className="font-semibold">{categoryLabel(done.category)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate">{t("department")}</dt>
              <dd className="font-semibold">{done.department}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate">{t("priority")}</dt>
              <dd>
                <PriorityBadge priority={done.priority} />
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={`/track?id=${done.tracking_id}`} className="btn btn-primary">
              {t("track_this")}
            </Link>
            <button type="button" onClick={reset} className="btn btn-quiet">
              {t("file_another")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("complaint_title")}</h1>

      {!analysis ? (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void analyze();
          }}
        >
          <div>
            <label className="lbl" htmlFor="problem">
              {t("describe_problem")}
            </label>
            <p className="mb-2 text-sm text-slate">{t("complaint_hint")}</p>
            <div className="flex items-start gap-2">
              <textarea
                id="problem"
                className="field min-h-40 flex-1"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={3000}
                required
                minLength={10}
              />
              <MicButton onText={(v) => setText(v)} />
            </div>
          </div>
          <div>
            <label className="lbl" htmlFor="loc">
              {t("location")}
            </label>
            <input id="loc" className="field" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200} />
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-[#f7dcd8] px-3 py-2 text-brick">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || text.trim().length < 10} className="btn btn-primary">
            <Sparkles size={18} aria-hidden /> {busy ? t("analyzing") : t("analyze")}
          </button>
        </form>
      ) : (
        <div className="mt-4 space-y-5">
          <div>
            <h2 className="text-xl font-bold">{t("review_title")}</h2>
            <p className="text-slate">{t("review_hint")}</p>
          </div>

          <div className="rounded-lg border border-line bg-white p-4">
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-slate">{t("category")}</dt>
                <dd className="font-semibold">{categoryLabel(analysis.category)}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate">{t("department")}</dt>
                <dd className="font-semibold">{analysis.department}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate">{t("priority")}</dt>
                <dd>
                  <PriorityBadge priority={analysis.priority} />
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-slate">{analysis.mode === "gemini" ? t("ai_note_gemini") : t("ai_note_offline")}</p>
          </div>

          <div>
            <label className="lbl" htmlFor="ttl">
              {t("title")}
            </label>
            <input id="ttl" className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>

          <div>
            <label className="lbl" htmlFor="drf">
              {t("draft")}
            </label>
            <textarea id="drf" className="field min-h-48" value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>

          {analysis.missing_info.length > 0 && (
            <div className="rounded-lg bg-turmeric-soft p-4">
              <p className="font-semibold">{t("missing")}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {analysis.missing_info.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-md bg-[#f7dcd8] px-3 py-2 text-brick">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void submit()} disabled={busy} className="btn btn-primary">
              {busy ? t("submitting") : t("submit_complaint")}
            </button>
            <button type="button" onClick={() => setAnalysis(null)} disabled={busy} className="btn btn-quiet">
              {t("back_edit")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
