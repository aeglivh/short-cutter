"use client";

import { useState, useEffect } from "react";

const APP_VERSION = "1.1.0";
const VERSION_KEY = "sc-version";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.1.0",
    date: "2026-03-12",
    changes: [
      "Virality score (1-100) — AI rates each Short's viral potential",
      "Batch export — export all suggested clips with one click",
      "Auto-captions — burn subtitles into exported videos (optional)",
      "Transcript data now carries over to the Clip Cutter",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-03-11",
    changes: [
      "Short Finder — paste a YouTube URL, get AI-powered Short suggestions",
      "Clip Cutter — trim and export clips in the browser with ffmpeg.wasm",
      "9:16 aspect ratio crop with draggable overlay",
      "Video persists across page refreshes (IndexedDB)",
      "Transcript viewer and generator",
      "Analysis history with local storage",
    ],
  },
];

export default function WhatsNewModal() {
  const [show, setShow] = useState(false);
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);

  useEffect(() => {
    const seen = localStorage.getItem(VERSION_KEY);
    if (seen !== APP_VERSION) {
      const newEntries = seen
        ? CHANGELOG.filter((e) => e.version > seen)
        : [CHANGELOG[0]];
      setEntries(newEntries.length > 0 ? newEntries : [CHANGELOG[0]]);
      setShow(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    setShow(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (show) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full mx-4 p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">&#10024;</span>
          <h2 className="text-lg font-bold text-white">What&apos;s New</h2>
        </div>

        <div className="space-y-5 max-h-80 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <div key={entry.version}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono bg-orange-600 text-white px-2 py-0.5 rounded">
                  v{entry.version}
                </span>
                <span className="text-xs text-zinc-500">{entry.date}</span>
              </div>
              <ul className="space-y-1.5">
                {entry.changes.map((change, i) => (
                  <li key={i} className="flex gap-2 text-sm text-zinc-300">
                    <span className="text-orange-500 mt-0.5 shrink-0">&#8226;</span>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button
          onClick={handleClose}
          className="mt-5 w-full px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-medium rounded-lg transition-colors cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
