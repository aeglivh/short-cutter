"use client";

interface UrlInputProps {
  url: string;
  onUrlChange: (url: string) => void;
  onAnalyze: () => void;
  loading: boolean;
}

export default function UrlInput({
  url,
  onUrlChange,
  onAnalyze,
  loading,
}: UrlInputProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex gap-3">
        <input
          type="text"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && onAnalyze()}
          placeholder="Paste a YouTube URL..."
          className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
          disabled={loading}
        />
        <button
          onClick={onAnalyze}
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
              Analyzing...
            </span>
          ) : (
            "Find Shorts"
          )}
        </button>
      </div>
    </div>
  );
}
