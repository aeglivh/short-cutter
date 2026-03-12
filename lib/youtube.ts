import { Supadata } from "@supadata/js";
import { TranscriptSegment } from "./types";

const supadata = new Supadata({
  apiKey: process.env.SUPADATA_API_KEY || "",
});

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
  const result = await supadata.youtube.transcript({
    url: `https://www.youtube.com/watch?v=${videoId}`,
    lang: "en",
  });

  if (!result.content || typeof result.content === "string" || result.content.length === 0) {
    return [];
  }

  return result.content.map(
    (item: { text: string; offset: number; duration: number }) => ({
      text: item.text,
      offset: Math.floor(item.offset / 1000),
      duration: Math.floor(item.duration / 1000),
    })
  );
}

export function parseManualTranscript(text: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = text.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    const match = line.match(
      /^\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*(.+)/
    );
    if (match) {
      let offset: number;
      if (match[3]) {
        offset =
          parseInt(match[1]) * 3600 +
          parseInt(match[2]) * 60 +
          parseInt(match[3]);
      } else {
        offset = parseInt(match[1]) * 60 + parseInt(match[2]);
      }
      segments.push({ text: match[4].trim(), offset, duration: 0 });
    } else {
      segments.push({
        text: line.trim(),
        offset: segments.length * 5,
        duration: 5,
      });
    }
  }

  return segments;
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
