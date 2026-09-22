import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import Complaints from "./officer/Complaints";
import Knowledge from "./officer/Knowledge";
import Overview from "./officer/Overview";

type Tab = "overview" | "complaints" | "knowledge";

export default function Officer() {
  const { t } = useI18n();
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  if (!ready) return <p className="mx-auto max-w-6xl px-4 py-10 text-slate">{t("loading")}</p>;
  if (user?.role !== "officer") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold">{t("officers_only")}</h1>
        <p className="mt-2 text-slate">{t("officers_only_p")}</p>
        {!user && (
          <Link to="/login" state={{ from: "/officer" }} className="btn btn-primary mt-5">
            {t("login")}
          </Link>
        )}
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: t("tab_overview") },
    { id: "complaints", label: t("tab_complaints") },
    { id: "knowledge", label: t("tab_knowledge") },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t("off_title")}</h1>
      <div role="tablist" aria-label={t("off_title")} className="mt-4 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((x) => (
          <button
            key={x.id}
            role="tab"
            type="button"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`whitespace-nowrap border-b-[3px] px-4 py-2 font-semibold ${tab === x.id ? "border-turmeric text-ink" : "border-transparent text-slate hover:text-ink"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-6">
        {tab === "overview" && <Overview />}
        {tab === "complaints" && <Complaints />}
        {tab === "knowledge" && <Knowledge />}
      </div>
    </div>
  );
}
