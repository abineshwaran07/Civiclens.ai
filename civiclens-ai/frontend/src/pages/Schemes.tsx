import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import type { Scheme } from "../lib/types";

const SECTION_KEYS = ["overview", "benefits", "eligibility", "how_to_apply", "documents"] as const;

export default function Schemes() {
  const { t, lang } = useI18n();
  const [schemes, setSchemes] = useState<Scheme[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api.get<Scheme[]>("/api/schemes").then(setSchemes).catch((e: Error) => setError(e.message));
  }, []);

  const categories = useMemo(() => Array.from(new Set((schemes ?? []).map((s) => s.category))).sort(), [schemes]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (schemes ?? []).filter(
      (s) =>
        (!category || s.category === category) &&
        (!needle ||
          s.name.toLowerCase().includes(needle) ||
          (s.name_ta ?? "").includes(q.trim()) ||
          s.department.toLowerCase().includes(needle) ||
          s.category.toLowerCase().includes(needle)),
    );
  }, [schemes, q, category]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold">{t("schemes_title")}</h1>

      <div className="mt-5">
        <label htmlFor="scheme-search" className="sr-only">{t("search_schemes")}</label>
        <input
          id="scheme-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search_schemes")}
          className="field max-w-xl"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {["", ...categories].map((c) => (
            <button
              key={c || "all"}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={`rounded-full border-[1.5px] px-3 py-1 text-sm font-semibold ${
                category === c ? "border-ink bg-ink text-white" : "border-ink/30 bg-white hover:border-ink"
              }`}
            >
              {c || t("all")}
            </button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="mt-6 text-brick">{error}</p>}
      {!schemes && !error && <p className="mt-6 text-slate">{t("loading")}</p>}
      {schemes && shown.length === 0 && <p className="mt-6 text-slate">{t("no_results")}</p>}

      <ul className="mt-6 divide-y divide-line border-y border-line">
        {shown.map((s) => {
          const isOpen = open === s.slug;
          const primary = lang === "ta" && s.name_ta ? s.name_ta : s.name;
          const secondary = lang === "ta" && s.name_ta ? s.name : s.name_ta;
          return (
            <li key={s.slug}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : s.slug)}
                className="flex w-full items-start justify-between gap-4 px-1 py-4 text-left hover:bg-white/70"
              >
                <span>
                  <span className="block font-display text-lg font-semibold">{primary}</span>
                  {secondary && <span className="block text-slate">{secondary}</span>}
                  <span className="mt-1 block text-sm text-slate">
                    {s.department}, {s.level}, {s.category}
                  </span>
                </span>
                <span aria-hidden="true" className="mt-1 text-2xl leading-none text-ink-soft">{isOpen ? "−" : "+"}</span>
              </button>

              {isOpen && (
                <div className="bg-white px-5 py-5">
                  <dl className="space-y-4">
                    {SECTION_KEYS.filter((k) => s.sections[k]).map((k) => (
                      <div key={k}>
                        <dt className="font-semibold text-ink-soft">{t(k)}</dt>
                        <dd className="mt-0.5">{s.sections[k]}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      to={`/assistant?q=${encodeURIComponent(lang === "ta" ? `${s.name_ta ?? s.name} பற்றி சொல்லுங்கள்` : `Tell me about ${s.name}`)}`}
                      className="btn btn-primary btn-small"
                    >
                      {t("ask_about_this")}
                    </Link>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noreferrer" className="btn btn-quiet btn-small">
                        {t("official_site")}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
