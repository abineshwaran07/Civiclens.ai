import { Mic, Square } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useSpeechInput } from "../lib/speech";

interface Props {
  onText: (text: string, isFinal: boolean) => void;
  className?: string;
}

/** Push-to-talk button. Uses the browser's speech recognition in the current UI language (Tamil or English). */
export default function MicButton({ onText, className = "" }: Props) {
  const { lang, t } = useI18n();
  const { supported, listening, start, stop } = useSpeechInput(lang, onText);
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      aria-pressed={listening}
      aria-label={listening ? t("stop") : t("speak")}
      title={listening ? t("listening") : t("speak")}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink transition-colors ${
        listening ? "bg-turmeric text-ink" : "bg-white text-ink hover:bg-turmeric-soft"
      } ${className}`}
    >
      {listening ? <Square size={18} fill="currentColor" /> : <Mic size={20} />}
    </button>
  );
}
