import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { DEMO_LOGINS } from "../lib/constants";
import { useI18n } from "../lib/i18n";
import type { User } from "../lib/types";

export default function Login({ mode }: { mode: "login" | "register" }) {
  const { t, lang } = useI18n();
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === "register";

  const done = (u: User) => navigate(u.role === "officer" ? "/officer" : from ?? "/complaint", { replace: true });

  const run = async (fn: () => Promise<User>) => {
    setBusy(true);
    setError(null);
    try {
      done(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error_generic"));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => (isRegister ? register(name.trim(), email.trim(), password, lang) : login(email.trim(), password)));
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold">{isRegister ? t("register_title") : t("login_title")}</h1>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {isRegister && (
          <div>
            <label className="lbl" htmlFor="name">
              {t("name")}
            </label>
            <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} />
          </div>
        )}
        <div>
          <label className="lbl" htmlFor="email">
            {t("email")}
          </label>
          <input id="email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div>
          <label className="lbl" htmlFor="password">
            {t("password")}
          </label>
          <input
            id="password"
            type="password"
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            minLength={6}
          />
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-[#f7dcd8] px-3 py-2 text-brick">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          {busy ? t("loading") : isRegister ? t("register") : t("login")}
        </button>
      </form>

      <p className="mt-4 text-slate">
        {isRegister ? t("have_account") : t("no_account")}{" "}
        <Link to={isRegister ? "/login" : "/register"} state={location.state} className="font-semibold text-ink underline">
          {isRegister ? t("login") : t("register")}
        </Link>
      </p>

      {!isRegister && (
        <section className="mt-8 rounded-lg border border-line bg-white p-4">
          <h2 className="text-base font-bold">{t("demo_logins")}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} className="btn btn-quiet btn-small" onClick={() => void run(() => login(DEMO_LOGINS.citizen.email, DEMO_LOGINS.citizen.password))}>
              {t("use_citizen")}
            </button>
            <button type="button" disabled={busy} className="btn btn-quiet btn-small" onClick={() => void run(() => login(DEMO_LOGINS.officer.email, DEMO_LOGINS.officer.password))}>
              {t("use_officer")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
