import { YoutubeTranscript } from "youtube-transcript";
import { TranscriptSegment } from "./types";

export function extractVideoId(url: string): string | null {
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
  return null;
}

export async function fetchTranscript(
  videoId: string
): Promise<TranscriptSegment[]> {
  const raw = await YoutubeTranscript.fetchTranscript(videoId);

  return raw.map((segment) => ({
    text: segment.text,
    offset: Math.floor(segment.offset / 1000),
    duration: Math.floor(segment.duration / 1000),
  }));
}

export function formatTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => {
      const min = Math.floor(s.offset / 60);
      const sec = s.offset % 60;
      const timestamp = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
      return `[${timestamp}] ${s.text}`;
    })
    .join("\n");
}
