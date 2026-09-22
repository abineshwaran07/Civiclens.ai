import type { Lang } from "./types";

export function formatDate(iso: string, lang: Lang, withTime = true): string {
  return new Date(iso).toLocaleString(lang === "ta" ? "ta-IN" : "en-IN", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  });
}
