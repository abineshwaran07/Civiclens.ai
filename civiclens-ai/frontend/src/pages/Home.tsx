import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import MicButton from "../components/MicButton";
import { SAMPLE_QUESTIONS, useI18n } from "../lib/i18n";

export default function Home() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const go = (text: string) => {
    const v = text.trim();
    if (v) navigate(`/assistant?q=${encodeURIComponent(v)}`);
  };

  const rows = [
    { to: "/assistant", h: t("home_ask_h"), p: t("home_ask_p") },
    { to: "/schemes", h: t("home_schemes_h"), p: t("home_schemes_p") },
    { to: "/complaint", h: t("home_complaint_h"), p: t("home_complaint_p") },
  ];

  return (
    <>
      <section className="kolam border-b border-line">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-12 md:pb-20 md:pt-20">
          <h1 className="max-w-3xl text-3xl font-bold md:text-5xl md:leading-tight">{t("hero_title")}</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate">{t("hero_sub")}</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              go(q);
            }}
            className="mt-8 flex max-w-3xl items-center gap-2 rounded-xl border-2 border-ink bg-white p-2 shadow-[6px_6px_0_0_var(--color-turmeric)] focus-within:ring-4 focus-within:ring-turmeric-soft"
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label={t("ask_placeholder")}
              placeholder={t("ask_placeholder")}
              className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-lg outline-none placeholder:text-slate/70"
            />
            <MicButton
              onText={(text, isFinal) => {
                setQ(text);
                if (isFinal) go(text);
              }}
            />
            <button type="submit" className="btn btn-primary">
              {t("ask_button")}
            </button>
          </form>

          <div className="mt-8 max-w-3xl">
            <p className="font-semibold">{t("try_asking")}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {SAMPLE_QUESTIONS[lang].map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => go(s)}
                    className="rounded-full border-[1.5px] border-ink/30 bg-white/80 px-3.5 py-1.5 text-left hover:border-ink hover:bg-white"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <ul className="divide-y divide-line border-y border-line">
          {rows.map((r) => (
            <li key={r.to}>
              <Link to={r.to} className="group grid gap-1 px-1 py-6 md:grid-cols-[18rem_1fr] md:gap-8">
                <h2 className="text-xl font-bold decoration-turmeric decoration-[3px] underline-offset-4 group-hover:underline">{r.h}</h2>
                <p className="max-w-2xl text-slate">{r.p}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="max-w-3xl border-l-4 border-turmeric pl-5">
          <h2 className="text-2xl font-bold">{t("trust_h")}</h2>
          <p className="mt-2 text-lg">{t("trust_p")}</p>
        </div>
      </section>
    </>
  );
}
