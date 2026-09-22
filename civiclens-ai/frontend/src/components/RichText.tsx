import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\[\d+\]$/.test(part))
      return (
        <sup key={i} className="ml-0.5 rounded bg-turmeric-soft px-1 text-xs font-semibold text-ink">
          {part.slice(1, -1)}
        </sup>
      );
    return part;
  });
}

/** Minimal renderer for the assistant's answers: paragraphs, "- " bullets, **bold** and [n] citations. */
export default function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      const items = bullets;
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-2 list-disc space-y-1 pl-6">
          {items.map((b, i) => (
            <li key={i}>{inline(b)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*[-*•]\s+(.*)$/);
    if (m) bullets.push(m[1]);
    else {
      flush();
      if (line.trim()) blocks.push(<p key={`p-${blocks.length}`} className="my-2">{inline(line)}</p>);
    }
  }
  flush();
  return <div>{blocks}</div>;
}
