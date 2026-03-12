"use client";

import { useState } from "react";
import UrlInput from "@/components/url-input";
import ResultsCard from "@/components/results-card";
import TranscriptViewer from "@/components/transcript-viewer";
import { ShortSuggestion, TranscriptSegment } from "@/lib/types";

type InputMode = "url" | "paste";

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

export default function Home() {
  const [mode, setMode] = useState<InputMode>("url");
  const [url, setUrl] = useState("");
  const [pastedTranscript, setPastedTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [shorts, setShorts] = useState<ShortSuggestion[]>([]);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState(false);

  const handleAnalyze = async () => {
    if (mode === "url" && !url.trim()) return;
    if (mode === "paste" && !pastedTranscript.trim()) return;

    setLoading(true);
    setError(null);
    setShorts([]);
    setTranscript([]);
    setAnalyzed(false);

    try {
      const body =
        mode === "url"
          ? { url }
          : { transcript: pastedTranscript, url: url || undefined };

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setShorts(data.shorts);
        setTranscript(data.transcript || []);
      }
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
      setAnalyzed(true);
    }
  };

  const videoId = extractVideoId(url);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">
            <span className="text-orange-500">Short</span> Cutter
          </h1>
          <p className="text-zinc-400 text-lg">
            Find the best moments for Shorts in your videos.
          </p>
          <a
            href="/transcript"
            className="text-sm text-zinc-500 hover:text-orange-400 transition-colors mt-2 inline-block"
          >
            Just need a transcript? →
          </a>
        </div>

        {/* Mode tabs */}
        <div className="flex justify-center gap-1 mb-6">
          <button
            onClick={() => setMode("url")}
            className={`px-4 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
              mode === "url"
                ? "bg-orange-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            YouTube URL
          </button>
          <button
            onClick={() => setMode("paste")}
            className={`px-4 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
              mode === "paste"
                ? "bg-orange-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            Paste Transcript
          </button>
        </div>

        {/* URL Input */}
        {mode === "url" && (
          <UrlInput
            url={url}
            onUrlChange={setUrl}
            onAnalyze={handleAnalyze}
            loading={loading}
          />
        )}

        {/* Paste Input */}
        {mode === "paste" && (
          <div className="w-full max-w-2xl mx-auto space-y-3">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="YouTube URL (optional — for timestamp links)"
              className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
              disabled={loading}
            />
            <textarea
              value={pastedTranscript}
              onChange={(e) => setPastedTranscript(e.target.value)}
              placeholder={`Paste your transcript here...\n\nYou can get it from:\n• YouTube Studio → Subtitles → download .srt\n• YouTube video → "..." → Show transcript → copy all`}
              className="w-full h-48 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors resize-y"
              disabled={loading}
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !pastedTranscript.trim()}
              className="w-full px-6 py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
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
                  Analyzing...
                </span>
              ) : (
                "Find Shorts"
              )}
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center mt-16">
            <div className="inline-flex items-center gap-3 text-zinc-400">
              <svg
                className="animate-spin h-5 w-5"
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
              <span>
                {mode === "url"
                  ? "Fetching transcript & finding the best moments..."
                  : "Analyzing transcript for the best moments..."}
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-8 p-4 bg-red-950 border border-red-800 rounded-lg text-red-300 text-center">
            <p>{error}</p>
            {mode === "url" && error.includes("caption") && (
              <button
                onClick={() => setMode("paste")}
                className="mt-2 text-orange-400 hover:text-orange-300 text-sm underline cursor-pointer"
              >
                Switch to paste transcript instead
              </button>
            )}
          </div>
        )}

        {/* Results */}
        {shorts.length > 0 && (
          <div className="mt-12 space-y-6">
            <h2 className="text-xl font-semibold text-zinc-300">
              Found {shorts.length} Short{shorts.length !== 1 ? "s" : ""} to
              cut
            </h2>
            {shorts.map((short, i) => (
              <ResultsCard
                key={i}
                short={short}
                index={i}
                videoId={videoId}
              />
            ))}
          </div>
        )}

        {/* Transcript */}
        {transcript.length > 0 && (
          <TranscriptViewer segments={transcript} videoId={videoId} />
        )}

        {/* Empty state after analysis */}
        {analyzed && !error && shorts.length === 0 && !loading && (
          <div className="mt-8 text-center text-zinc-500">
            No good Short moments found in this video. Try a different one.
          </div>
        )}

        {/* Footer */}
        <div className="mt-20 text-center text-xs text-zinc-600">
          Built for Studio Egli — powered by Claude
        </div>
      </div>
    </div>
  );
}
