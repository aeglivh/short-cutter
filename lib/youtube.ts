import { getSubtitles } from "youtube-caption-extractor";
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
  const captions = await getSubtitles({ videoID: videoId, lang: "en" });

  return captions.map((caption) => ({
    text: caption.text,
    offset: Math.floor(parseFloat(caption.start)),
    duration: Math.floor(parseFloat(caption.dur)),
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
