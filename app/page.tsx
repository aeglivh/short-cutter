"use client";

import { useState } from "react";
import UrlInput from "@/components/url-input";
import ResultsCard from "@/components/results-card";
import TranscriptViewer from "@/components/transcript-viewer";
import { ShortSuggestion, TranscriptSegment } from "@/lib/types";

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
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [shorts, setShorts] = useState<ShortSuggestion[]>([]);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analyzed, setAnalyzed] = useState(false);

  const handleAnalyze = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setShorts([]);
    setTranscript([]);
    setAnalyzed(false);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
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
            Paste a YouTube URL. Get the best moments for Shorts.
          </p>
        </div>

        {/* Input */}
        <UrlInput
          url={url}
          onUrlChange={setUrl}
          onAnalyze={handleAnalyze}
          loading={loading}
        />

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
              <span>Fetching transcript & finding the best moments...</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-8 p-4 bg-red-950 border border-red-800 rounded-lg text-red-300 text-center">
            {error}
          </div>
        )}

        {/* Results */}
        {shorts.length > 0 && (
          <div className="mt-12 space-y-6">
            <h2 className="text-xl font-semibold text-zinc-300">
              Found {shorts.length} Short{shorts.length !== 1 ? "s" : ""} to cut
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
