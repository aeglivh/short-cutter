"use client";

import { useState } from "react";
import { ShortSuggestion } from "@/lib/types";

interface ResultsCardProps {
  short: ShortSuggestion;
  index: number;
  videoId: string;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

function timeToSeconds(time: string): number {
  const parts = time.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

export default function ResultsCard({
  short,
  index,
  videoId,
}: ResultsCardProps) {
  const startSeconds = timeToSeconds(short.startTime);
  const youtubeLink = `https://youtube.com/watch?v=${videoId}&t=${startSeconds}s`;

  const allText = `Title: ${short.title}\nHook: ${short.hookText}\nTimestamp: ${short.startTime} - ${short.endTime}\nDescription: ${short.description}`;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-orange-600 text-white px-2 py-0.5 rounded">
            SHORT {index + 1}
          </span>
          <a
            href={youtubeLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-orange-400 hover:text-orange-300 font-mono transition-colors"
          >
            {short.startTime} - {short.endTime}
          </a>
        </div>
        <CopyButton text={allText} label="Copy all" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            Title
          </span>
          <CopyButton text={short.title} label="Copy" />
        </div>
        <p className="text-white font-medium">{short.title}</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            Hook text (on-screen)
          </span>
          <CopyButton text={short.hookText} label="Copy" />
        </div>
        <p className="text-orange-400 font-bold text-lg">{short.hookText}</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            Description
          </span>
          <CopyButton text={short.description} label="Copy" />
        </div>
        <p className="text-zinc-300 text-sm whitespace-pre-wrap">
          {short.description}
        </p>
      </div>

      <div className="pt-2 border-t border-zinc-800">
        <p className="text-xs text-zinc-500 italic">{short.reasoning}</p>
      </div>
    </div>
  );
}
