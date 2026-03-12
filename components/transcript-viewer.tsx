"use client";

import { useState } from "react";
import { TranscriptSegment } from "@/lib/types";

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  videoId: string;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TranscriptViewer({
  segments,
  videoId,
}: TranscriptViewerProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fullText = segments
    .map((s) => `[${formatTime(s.offset)}] ${s.text}`)
    .join("\n");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mt-8 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        <span className="font-medium text-zinc-300">
          Full Transcript ({segments.length} segments)
        </span>
        <svg
          className={`w-5 h-5 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="bg-zinc-950">
          <div className="flex justify-end px-4 pt-3">
            <button
              onClick={handleCopy}
              className="text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              {copied ? "Copied!" : "Copy full transcript"}
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto px-5 py-3 space-y-1">
            {segments.map((s, i) => (
              <div key={i} className="flex gap-3 text-sm leading-relaxed">
                <a
                  href={`https://youtube.com/watch?v=${videoId}&t=${s.offset}s`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-500 hover:text-orange-400 font-mono shrink-0 transition-colors"
                >
                  {formatTime(s.offset)}
                </a>
                <span className="text-zinc-400">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
