import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import type { KnowledgeSource } from "../../lib/types";

interface Ingest {
  title: string;
  chunks: number;
  embedded: boolean;
}

export default function Knowledge() {
  const { t } = useI18n();
  const [sources, setSources] = useState<KnowledgeSource[] | null>(null);
  const [title, setTitle] = useState("");
  const [dept, setDept] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(() => {
    api
      .get<KnowledgeSource[]>("/api/officer/documents")
      .then(setSources)
      .catch((e) => setMsg({ ok: false, text: e instanceof Error ? e.message : t("error_generic") }));
  }, [t]);

  useEffect(refresh, [refresh]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      let res: Ingest;
      if (file) {
        const form = new FormData();
        form.append("file", file);
        form.append("title", title.trim());
        if (dept.trim()) form.append("department", dept.trim());
        if (url.trim()) form.append("url", url.trim());
        res = await api.upload<Ingest>("/api/officer/documents/upload", form);
      } else {
        res = await api.post<Ingest>("/api/officer/documents", {
          title: title.trim(),
          department: dept.trim() || null,
          url: url.trim() || null,
          text,
        });
      }
      setMsg({ ok: true, text: t("kb_added").replace("{n}", String(res.chunks)) });
      setTitle("");
      setDept("");
      setUrl("");
      setText("");
      setFile(null);
      refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : t("error_generic") });
    } finally {
      setBusy(false);
    }
  };

  const hasContent = file !== null || text.trim().length >= 50;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h2 className="text-xl font-bold">{t("kb_add")}</h2>
        <p className="mt-1 text-slate">{t("kb_hint")}</p>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="lbl" htmlFor="kb-title">
              {t("kb_doc_title")}
            </label>
            <input id="kb-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={250} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="lbl" htmlFor="kb-dept">
                {t("kb_doc_dept")}
              </label>
              <input id="kb-dept" className="field" value={dept} onChange={(e) => setDept(e.target.value)} maxLength={200} />
            </div>
            <div>
              <label className="lbl" htmlFor="kb-url">
                {t("kb_doc_url")}
              </label>
              <input id="kb-url" type="url" className="field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" maxLength={400} />
            </div>
          </div>
          <div>
            <label className="lbl" htmlFor="kb-text">
              {t("kb_doc_text")}
            </label>
            <textarea id="kb-text" className="field min-h-40" value={text} onChange={(e) => setText(e.target.value)} disabled={file !== null} />
          </div>
          <div>
            <label className="lbl" htmlFor="kb-file">
              {t("kb_or_file")}
            </label>
            <input id="kb-file" type="file" accept=".pdf,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:font-semibold file:text-white" />
          </div>
          {msg && (
            <p role="status" className={`rounded-md px-3 py-2 ${msg.ok ? "bg-[#d9f0e6] text-leaf" : "bg-[#f7dcd8] text-brick"}`}>
              {msg.text}
            </p>
          )}
          <button type="submit" disabled={busy || !hasContent || title.trim().length < 3} className="btn btn-primary">
            {busy ? t("kb_adding") : t("kb_add_button")}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-bold">{t("kb_sources")}</h2>
        {!sources ? (
          <p className="mt-3 text-slate">{t("loading")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-white">
            {sources.map((s) => (
              <li key={s.title} className="flex items-start justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-semibold">{s.title}</p>
                  {s.department && <p className="text-sm text-slate">{s.department}</p>}
                </div>
                <span className="whitespace-nowrap text-sm text-slate">
                  {s.chunks} {t("passages")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
