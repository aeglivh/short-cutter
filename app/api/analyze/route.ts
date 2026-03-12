import { NextRequest, NextResponse } from "next/server";
import {
  extractVideoId,
  fetchTranscript,
  formatTranscript,
  parseManualTranscript,
} from "@/lib/youtube";
import { analyzeTranscript } from "@/lib/claude";
import { AnalyzeResponse } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { url, transcript: manualTranscript } = await req.json();

    let segments;
    let videoId: string | null = null;

    if (manualTranscript && typeof manualTranscript === "string") {
      // Manual transcript pasted by user
      segments = parseManualTranscript(manualTranscript);
      if (url) videoId = extractVideoId(url);
    } else if (url && typeof url === "string") {
      // Auto-fetch from YouTube URL
      videoId = extractVideoId(url);
      if (!videoId) {
        return NextResponse.json(
          {
            shorts: [],
            transcript: [],
            error:
              "Invalid YouTube URL. Paste a link like https://youtube.com/watch?v=...",
          } as AnalyzeResponse,
          { status: 400 }
        );
      }

      try {
        segments = await fetchTranscript(videoId);
      } catch {
        return NextResponse.json(
          {
            shorts: [],
            transcript: [],
            error:
              "Could not fetch captions. Try pasting the transcript manually instead.",
          } as AnalyzeResponse,
          { status: 422 }
        );
      }
    } else {
      return NextResponse.json(
        {
          shorts: [],
          transcript: [],
          error: "Please provide a YouTube URL or paste a transcript.",
        } as AnalyzeResponse,
        { status: 400 }
      );
    }

    if (!segments || segments.length === 0) {
      return NextResponse.json(
        {
          shorts: [],
          transcript: [],
          error:
            "No captions found. Try pasting the transcript manually instead.",
        } as AnalyzeResponse,
        { status: 422 }
      );
    }

    const formatted = formatTranscript(segments);
    const shorts = await analyzeTranscript(formatted);

    return NextResponse.json({
      shorts,
      transcript: segments,
    } as AnalyzeResponse);
  } catch (error) {
    console.error("Analysis failed:", error);
    return NextResponse.json(
      {
        shorts: [],
        transcript: [],
        error: "Something went wrong analyzing the video. Please try again.",
      } as AnalyzeResponse,
      { status: 500 }
    );
  }
}
