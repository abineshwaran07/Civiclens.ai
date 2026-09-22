import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const speechCtor = (): any =>
  typeof window === "undefined" ? undefined : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const TAMIL = /[\u0B80-\u0BFF]/;
export const detectLang = (text: string): Lang => (TAMIL.test(text) ? "ta" : "en");

/** Browser speech-to-text (Chrome, Edge, Safari). Tamil uses ta-IN. */
export function useSpeechInput(lang: Lang, onResult: (text: string, isFinal: boolean) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const cb = useRef(onResult);
  cb.current = onResult;
  const supported = !!speechCtor();

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = speechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang === "ta" ? "ta-IN" : "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let text = "";
      let isFinal = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) isFinal = true;
      }
      cb.current(text, isFinal);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [lang]);

  useEffect(() => () => recRef.current?.abort?.(), []);
  return { supported, listening, start, stop };
}

/** Browser text-to-speech. */
export function speak(text: string, lang: Lang) {
  if (!("speechSynthesis" in window)) return;
  const clean = text.replace(/\*\*/g, "").replace(/\[\d+\]/g, "").replace(/^- /gm, "");
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = lang === "ta" ? "ta-IN" : "en-IN";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export const stopSpeaking = () => {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
};
