import { NextRequest, NextResponse } from "next/server";
import { extractVideoId, fetchTranscript, formatTranscript } from "@/lib/youtube";
import { analyzeTranscript } from "@/lib/claude";
import { AnalyzeResponse } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { shorts: [], error: "Please provide a YouTube URL" } as AnalyzeResponse,
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { shorts: [], error: "Invalid YouTube URL. Paste a link like https://youtube.com/watch?v=..." } as AnalyzeResponse,
        { status: 400 }
      );
    }

    let segments;
    try {
      segments = await fetchTranscript(videoId);
    } catch {
      return NextResponse.json(
        { shorts: [], error: "Could not fetch captions for this video. Make sure the video has captions enabled." } as AnalyzeResponse,
        { status: 422 }
      );
    }

    if (segments.length === 0) {
      return NextResponse.json(
        { shorts: [], error: "This video has no captions available." } as AnalyzeResponse,
        { status: 422 }
      );
    }

    const formatted = formatTranscript(segments);
    const shorts = await analyzeTranscript(formatted);

    return NextResponse.json({ shorts } as AnalyzeResponse);
  } catch (error) {
    console.error("Analysis failed:", error);
    return NextResponse.json(
      { shorts: [], error: "Something went wrong analyzing the video. Please try again." } as AnalyzeResponse,
      { status: 500 }
    );
  }
}
