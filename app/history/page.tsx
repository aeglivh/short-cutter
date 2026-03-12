"use client";

import { useState, useEffect } from "react";
import { getAllResults, clearResult, StoredResult } from "@/lib/storage";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Thumbnail({ videoId }: { videoId: string }) {
  return (
    <img
      src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
      alt="Video thumbnail"
      className="w-40 h-[90px] object-cover rounded-lg shrink-0"
    />
  );
}

export default function HistoryPage() {
  const [results, setResults] = useState<StoredResult[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setResults(getAllResults());
  }, []);

  const handleDelete = (videoId: string) => {
    clearResult(videoId);
    setResults(getAllResults());
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">
            <span className="text-orange-500">History</span>
          </h1>
          <p className="text-zinc-400 text-lg">Your analyzed videos</p>
          <div className="flex justify-center gap-4 mt-2">
            <a
              href="/"
              className="text-sm text-zinc-500 hover:text-orange-400 transition-colors"
            >
              ← Short Cutter
            </a>
            <a
              href="/transcript"
              className="text-sm text-zinc-500 hover:text-orange-400 transition-colors"
            >
              Transcript Generator
            </a>
          </div>
        </div>

        {/* Empty state */}
        {results.length === 0 && (
          <div className="text-center text-zinc-500 mt-16">
            <p className="text-lg">No videos analyzed yet.</p>
            <a
              href="/"
              className="text-orange-400 hover:text-orange-300 text-sm mt-2 inline-block transition-colors"
            >
              Analyze your first video →
            </a>
          </div>
        )}

        {/* Video list */}
        <div className="space-y-4">
          {results.map((result) => (
            <div
              key={result.videoId}
              className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
            >
              {/* Video card header */}
              <div className="flex items-center gap-4 p-4">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Thumbnail videoId={result.videoId} />
                </a>
                <div className="flex-1 min-w-0">
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-zinc-400 hover:text-orange-400 font-mono truncate block transition-colors"
                  >
                    {result.url}
                  </a>
                  <p className="text-xs text-zinc-600 mt-1">
                    {formatDate(result.timestamp)}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs bg-orange-600/20 text-orange-400 px-2 py-0.5 rounded">
                      {result.shorts.length} Short
                      {result.shorts.length !== 1 ? "s" : ""}
                    </span>
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                      {result.transcript.length} segments
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      setExpanded(
                        expanded === result.videoId ? null : result.videoId
                      )
                    }
                    className="text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {expanded === result.videoId ? "Collapse" : "View Shorts"}
                  </button>
                  <button
                    onClick={() => handleDelete(result.videoId)}
                    className="text-xs px-2 py-1.5 rounded bg-zinc-800 hover:bg-red-900 text-zinc-500 hover:text-red-300 transition-colors cursor-pointer"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Expanded shorts */}
              {expanded === result.videoId && (
                <div className="border-t border-zinc-800 p-4 space-y-3">
                  {result.shorts.map((short, i) => (
                    <div
                      key={i}
                      className="bg-zinc-950 rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-orange-600 text-white px-1.5 py-0.5 rounded">
                          {i + 1}
                        </span>
                        <a
                          href={`https://youtube.com/watch?v=${result.videoId}&t=${timeToSeconds(short.startTime)}s`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-orange-400 hover:text-orange-300 font-mono transition-colors"
                        >
                          {short.startTime} - {short.endTime}
                        </a>
                      </div>
                      <p className="text-white font-medium text-sm">
                        {short.title}
                      </p>
                      <p className="text-orange-400 font-bold text-sm">
                        {short.hookText}
                      </p>
                      <p className="text-zinc-400 text-xs">
                        {short.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-20 text-center text-xs text-zinc-600">
          Powered by Claude AI
        </div>
      </div>
    </div>
  );
}

function timeToSeconds(time: string): number {
  const parts = time.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}
