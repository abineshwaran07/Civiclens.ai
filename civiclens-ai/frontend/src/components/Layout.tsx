import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1b2559" />
      <circle cx="32" cy="32" r="12" fill="none" stroke="#f0b400" strokeWidth="6" />
    </svg>
  );
}

export default function Layout() {
  const { t, lang, setLang } = useI18n();
  const { user, logout } = useAuth();

  const links = [
    { to: "/assistant", label: t("nav_ask") },
    { to: "/schemes", label: t("nav_schemes") },
    { to: "/complaint", label: t("nav_complaint") },
    { to: "/track", label: t("nav_track") },
    ...(user?.role === "citizen" ? [{ to: "/my", label: t("nav_mine") }] : []),
    ...(user?.role === "officer" ? [{ to: "/officer", label: t("nav_officer") }] : []),
  ];

  const langBtn = (code: "en" | "ta", label: string) => (
    <button
      type="button"
      aria-pressed={lang === code}
      onClick={() => setLang(code)}
      className={`h-9 px-3 text-sm font-semibold ${lang === code ? "bg-ink text-white" : "bg-transparent text-ink hover:bg-white"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold text-ink">
            <Logo />
            CivicLens
          </Link>

          <nav aria-label="Main" className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto md:flex-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `whitespace-nowrap border-b-[3px] px-2.5 py-2 font-semibold ${
                    isActive ? "border-turmeric text-ink" : "border-transparent text-slate hover:text-ink"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <div role="group" aria-label="Language" className="inline-flex overflow-hidden rounded-md border-[1.5px] border-ink">
              {langBtn("en", "English")}
              {langBtn("ta", "தமிழ்")}
            </div>
            {user ? (
              <button type="button" onClick={logout} className="btn btn-quiet btn-small">
                {t("logout")}
              </button>
            ) : (
              <Link to="/login" className="btn btn-primary btn-small">
                {t("login")}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate">
          <p>{t("footer")}</p>
          <p className="mt-1">{t("footer_note")}</p>
        </div>
      </footer>
    </div>
  );
}
