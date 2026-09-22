import { Send, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import MicButton from "../components/MicButton";
import RichText from "../components/RichText";
import { api } from "../lib/api";
import { SAMPLE_QUESTIONS, useI18n } from "../lib/i18n";
import { speak, stopSpeaking } from "../lib/speech";
import type { ChatReply } from "../lib/types";

interface Msg {
  role: "user" | "assistant";
  content: string;
  reply?: ChatReply;
}

export default function Assistant() {
  const { t, lang } = useI18n();
  const [params] = useSearchParams();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      const history = msgs.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      setMsgs((m) => [...m, { role: "user", content: message }]);
      setInput("");
      setBusy(true);
      setError(null);
      stopSpeaking();
      try {
        const reply = await api.post<ChatReply>("/api/chat", { message, history });
        setMsgs((m) => [...m, { role: "assistant", content: reply.answer, reply }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("error_generic"));
      } finally {
        setBusy(false);
      }
    },
    [msgs, busy, t],
  );

  const sendRef = useRef(send);
  sendRef.current = send;

  // A question passed from the home page (?q=...) is asked once on arrival.
  useEffect(() => {
    const q = params.get("q");
    if (q && !started.current) {
      started.current = true;
      void sendRef.current(q);
    }
  }, [params]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [msgs, busy]);

  useEffect(() => () => stopSpeaking(), []);

  const offline = msgs.some((m) => m.reply?.mode === "offline");

  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-3xl flex-col px-4">
      <div className="flex-1 py-6" aria-live="polite">
        {msgs.length === 0 && !busy && (
          <div className="py-6">
            <h1 className="text-2xl font-bold">{t("hero_title")}</h1>
            <p className="mt-2 text-slate">{t("hero_sub")}</p>
            <p className="mt-6 font-semibold">{t("try_asking")}</p>
            <ul className="mt-2 space-y-2">
              {SAMPLE_QUESTIONS[lang].map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => void send(s)}
                    className="w-full rounded-lg border-[1.5px] border-line bg-white px-4 py-3 text-left hover:border-ink"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-6">
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-white">
                {m.content}
              </div>
            ) : (
              <article key={i} className="rounded-2xl rounded-bl-sm border border-line bg-white px-5 py-4">
                {m.reply && !m.reply.grounded && <p className="font-semibold text-brick">{t("no_source_title")}</p>}
                <RichText text={m.content} />

                {m.reply && m.reply.sources.length > 0 && (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="text-sm font-semibold text-slate">{t("sources")}</p>
                    <ul className="mt-1 space-y-1.5">
                      {m.reply.sources.map((s) => (
                        <li key={s.id} className="text-sm">
                          <span className="mr-2 rounded bg-turmeric-soft px-1.5 font-semibold">{s.id}</span>
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold underline decoration-turmeric decoration-2 underline-offset-2">
                              {s.title}
                            </a>
                          ) : (
                            <span className="font-semibold">{s.title}</span>
                          )}
                          <span className="text-slate">, {s.section}</span>
                          {s.department && <span className="block pl-8 text-slate">{s.department}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {m.reply && !m.reply.grounded && (
                  <p className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
                    <Link to="/schemes" className="underline underline-offset-2">{t("nav_schemes")}</Link>
                    <Link to="/complaint" className="underline underline-offset-2">{t("nav_complaint")}</Link>
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => speak(m.content, m.reply?.language ?? lang)}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
                >
                  <Volume2 size={16} /> {t("read_aloud")}
                </button>
              </article>
            ),
          )}
          {busy && <p className="text-slate">{t("thinking")}</p>}
          {error && (
            <p role="alert" className="rounded-lg border border-brick/40 bg-[#f7dcd8] px-4 py-3 text-brick">
              {error}
            </p>
          )}
        </div>
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-paper px-4 pb-4 pt-3">
        {offline && <p className="mb-2 text-sm text-slate">{t("demo_mode")}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-center gap-2 rounded-xl border-2 border-ink bg-white p-1.5 focus-within:ring-4 focus-within:ring-turmeric-soft"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label={t("ask_placeholder")}
            placeholder={t("ask_placeholder")}
            className="min-h-11 min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-slate/70"
          />
          <MicButton
            onText={(text, isFinal) => {
              setInput(text);
              if (isFinal) void sendRef.current(text);
            }}
          />
          <button type="submit" disabled={busy || !input.trim()} className="btn btn-primary" aria-label={t("ask_button")}>
            <Send size={18} />
            <span className="hidden sm:inline">{t("ask_button")}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
