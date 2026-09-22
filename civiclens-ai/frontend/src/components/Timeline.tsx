import { formatDate } from "../lib/format";
import { useI18n } from "../lib/i18n";
import type { GrievanceEvent } from "../lib/types";
import { StatusBadge } from "./Badges";

export default function Timeline({ events }: { events: GrievanceEvent[] }) {
  const { lang } = useI18n();
  return (
    <ol className="ml-2 border-l-2 border-line">
      {events.map((e, i) => (
        <li key={i} className="relative pb-5 pl-6 last:pb-0">
          <span
            className={`absolute -left-[7px] top-2 h-3 w-3 rounded-full border-2 border-paper ${
              i === events.length - 1 ? "bg-turmeric" : "bg-ink"
            }`}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge status={e.status} />
            <time className="text-sm text-slate" dateTime={e.created_at}>
              {formatDate(e.created_at, lang)}
            </time>
          </div>
          {e.note && <p className="mt-1 text-slate">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}
