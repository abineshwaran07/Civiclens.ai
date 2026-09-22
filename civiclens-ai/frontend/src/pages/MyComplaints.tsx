import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PriorityBadge, StatusBadge } from "../components/Badges";
import Timeline from "../components/Timeline";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDate } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { Grievance } from "../lib/types";

export default function MyComplaints() {
  const { t, lang, categoryLabel } = useI18n();
  const { user } = useAuth();
  const [items, setItems] = useState<Grievance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<Grievance[]>("/api/grievances/mine")
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : t("error_generic")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("my_title")}</h1>
        {user?.role === "citizen" && (
          <Link to="/complaint" className="btn btn-primary btn-small">
            {t("nav_complaint")}
          </Link>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-[#f7dcd8] px-3 py-2 text-brick">
          {error}
        </p>
      )}
      {!items && !error && <p className="mt-4 text-slate">{t("loading")}</p>}
      {items && items.length === 0 && <p className="mt-4 text-slate">{t("my_empty")}</p>}

      <ul className="mt-5 space-y-3">
        {items?.map((g) => {
          const expanded = open === g.id;
          return (
            <li key={g.id} className="rounded-xl border border-line bg-white">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : g.id)}
                className="flex w-full flex-col gap-2 p-4 text-left"
              >
                <span className="font-mono text-sm font-bold tracking-wider text-slate">{g.tracking_id}</span>
                <span className="text-lg font-semibold">{g.title}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={g.status} />
                  <PriorityBadge priority={g.priority} />
                  <span className="text-sm text-slate">
                    {categoryLabel(g.category)} · {t("filed_on")} {formatDate(g.created_at, lang, false)}
                  </span>
                </span>
              </button>
              {expanded && (
                <div className="border-t border-line p-4">
                  <p className="text-sm text-slate">{t("department")}</p>
                  <p className="font-semibold">{g.department}</p>
                  <p className="mt-3 whitespace-pre-line">{g.description}</p>
                  <div className="mt-5">
                    <Timeline events={g.events} />
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
