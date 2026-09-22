import { useI18n } from "../lib/i18n";
import type { Priority, Status } from "../lib/types";

const STATUS_STYLE: Record<Status, string> = {
  submitted: "bg-[#eceef7] text-slate",
  in_review: "bg-[#dfe5ff] text-ink-soft",
  in_progress: "bg-turmeric-soft text-[#6b4e00]",
  resolved: "bg-[#d9f0e6] text-leaf",
  rejected: "bg-[#f7dcd8] text-brick",
};

const PRIORITY_STYLE: Record<Priority, string> = {
  low: "bg-[#eceef7] text-slate",
  medium: "bg-turmeric-soft text-[#6b4e00]",
  high: "bg-[#f7dcd8] text-brick",
  urgent: "bg-brick text-white",
};

const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap";

export function StatusBadge({ status }: { status: Status }) {
  const { statusLabel } = useI18n();
  return <span className={`${base} ${STATUS_STYLE[status]}`}>{statusLabel(status)}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { priorityLabel } = useI18n();
  return <span className={`${base} ${PRIORITY_STYLE[priority]}`}>{priorityLabel(priority)}</span>;
}
