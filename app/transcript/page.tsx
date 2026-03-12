"use client";

import { useState } from "react";
import { TranscriptSegment } from "@/lib/types";

function extractVideoId(url: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return "";
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type CopyFormat = "timestamps" | "plain" | "srt";

export default function TranscriptPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const videoId = extractVideoId(url);

  const handleFetch = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setSegments([]);
    setSearched(false);

    try {
      const res = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSegments(data.segments);
      }
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const copyAs = async (format: CopyFormat) => {
    let text = "";
    if (format === "timestamps") {
      text = segments
        .map((s) => `[${formatTime(s.offset)}] ${s.text}`)
        .join("\n");
    } else if (format === "plain") {
      text = segments.map((s) => s.text).join(" ");
    } else if (format === "srt") {
      text = segments
        .map((s, i) => {
          const start = formatSrt(s.offset);
          const end = formatSrt(s.offset + Math.max(s.duration, 1));
          return `${i + 1}\n${start} --> ${end}\n${s.text}\n`;
        })
        .join("\n");
    }
    await navigator.clipboard.writeText(text);
    setCopied(format);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">
            <span className="text-orange-500">Transcript</span> Generator
          </h1>
          <p className="text-zinc-400 text-lg">
            Paste a YouTube URL. Get the full transcript with timestamps.
          </p>
          <a
            href="/"
            className="text-sm text-zinc-500 hover:text-orange-400 transition-colors mt-2 inline-block"
          >
            ← Back to Short Cutter
          </a>
        </div>

        {/* Input */}
        <div className="w-full max-w-2xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleFetch()}
              placeholder="Paste a YouTube URL..."
              className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
              disabled={loading}
            />
            <button
              onClick={handleFetch}
              disabled={loading || !url.trim()}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Fetching...
                </span>
              ) : (
                "Get Transcript"
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-8 p-4 bg-red-950 border border-red-800 rounded-lg text-red-300 text-center">
            {error}
          </div>
        )}

        {/* Results */}
        {segments.length > 0 && (
          <div className="mt-10">
            {/* Copy Buttons */}
            <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
              <span className="text-zinc-400 text-sm">
                {segments.length} segments
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => copyAs("timestamps")}
                  className="text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  {copied === "timestamps"
                    ? "Copied!"
                    : "Copy with timestamps"}
                </button>
                <button
                  onClick={() => copyAs("plain")}
                  className="text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  {copied === "plain" ? "Copied!" : "Copy plain text"}
                </button>
                <button
                  onClick={() => copyAs("srt")}
                  className="text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  {copied === "srt" ? "Copied!" : "Copy as SRT"}
                </button>
              </div>
            </div>

            {/* Transcript lines */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-h-[600px] overflow-y-auto">
              <div className="px-5 py-4 space-y-1.5">
                {segments.map((s, i) => (
                  <div
                    key={i}
                    className="flex gap-3 text-sm leading-relaxed group"
                  >
                    <a
                      href={
                        videoId
                          ? `https://youtube.com/watch?v=${videoId}&t=${s.offset}s`
                          : "#"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-500 hover:text-orange-400 font-mono shrink-0 transition-colors"
                    >
                      {formatTime(s.offset)}
                    </a>
                    <span className="text-zinc-300 group-hover:text-white transition-colors">
                      {s.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Use for Shorts */}
            <div className="mt-6 text-center">
              <a
                href="/"
                className="text-orange-400 hover:text-orange-300 text-sm transition-colors"
              >
                Want to find the best Shorts from this transcript? →
              </a>
            </div>
          </div>
        )}

        {/* Empty state */}
        {searched && !error && segments.length === 0 && !loading && (
          <div className="mt-8 text-center text-zinc-500">
            No transcript found for this video.
          </div>
        )}

        {/* Footer */}
        <div className="mt-20 text-center text-xs text-zinc-600">
          Powered by Claude AI
        </div>
      </div>
    </div>
  );
}

function formatSrt(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},000`;
}
