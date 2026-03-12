import { NextRequest, NextResponse } from "next/server";
import { extractVideoId, fetchTranscript, formatTranscript } from "@/lib/youtube";
import { TranscriptSegment } from "@/lib/types";

export const maxDuration = 30;

interface TranscriptResponse {
  segments: TranscriptSegment[];
  formatted: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { segments: [], formatted: "", error: "Please provide a YouTube URL" } as TranscriptResponse,
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { segments: [], formatted: "", error: "Invalid YouTube URL." } as TranscriptResponse,
        { status: 400 }
      );
    }

    let segments;
    try {
      segments = await fetchTranscript(videoId);
    } catch {
      return NextResponse.json(
        { segments: [], formatted: "", error: "Could not fetch captions for this video." } as TranscriptResponse,
        { status: 422 }
      );
    }

    if (segments.length === 0) {
      return NextResponse.json(
        { segments: [], formatted: "", error: "No captions available for this video." } as TranscriptResponse,
        { status: 422 }
      );
    }

    const formatted = formatTranscript(segments);

    return NextResponse.json({ segments, formatted } as TranscriptResponse);
  } catch (error) {
    console.error("Transcript fetch failed:", error);
    return NextResponse.json(
      { segments: [], formatted: "", error: "Something went wrong. Please try again." } as TranscriptResponse,
      { status: 500 }
    );
  }
}
