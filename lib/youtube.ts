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

async function getCaptionTrack(
  videoId: string
): Promise<{ baseUrl: string; lang: string } | null> {
  const response = await fetch(
    `https://www.youtube.com/watch?v=${videoId}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=PENDING+987",
      },
    }
  );

  const html = await response.text();

  const captionsMatch = html.match(
    new RegExp('"captions"\\s*:\\s*(\\{.*?\\}),\\s*"videoDetails', "s")
  );
  if (!captionsMatch) return null;

  let captions;
  try {
    captions = JSON.parse(captionsMatch[1]);
  } catch {
    return null;
  }

  const tracks =
    captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) return null;

  const english = tracks.find(
    (t: { languageCode: string }) => t.languageCode === "en"
  );
  const track = english || tracks[0];

  return track?.baseUrl
    ? { baseUrl: track.baseUrl, lang: track.languageCode }
    : null;
}

function parseTimedText(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const regex =
    /<text start="([^"]*)" dur="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const start = parseFloat(match[1]);
    const dur = parseFloat(match[2]);
    const text = match[3]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (text) {
      segments.push({
        text,
        offset: Math.floor(start),
        duration: Math.floor(dur),
      });
    }
  }

  return segments;
}

function parseJson3(json: string): TranscriptSegment[] {
  const data = JSON.parse(json);
  const events = data?.events;
  if (!Array.isArray(events)) return [];

  const segments: TranscriptSegment[] = [];
  for (const event of events) {
    if (!event.segs || event.tStartMs === undefined) continue;
    const text = event.segs
      .map((s: { utf8: string }) => s.utf8)
      .join("")
      .trim();
    if (!text || text === "\n") continue;

    segments.push({
      text,
      offset: Math.floor(event.tStartMs / 1000),
      duration: Math.floor((event.dDurationMs || 0) / 1000),
    });
  }

  return segments;
}

export async function fetchTranscript(
  videoId: string
): Promise<TranscriptSegment[]> {
  const track = await getCaptionTrack(videoId);
  if (!track) return [];

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Cookie: "CONSENT=PENDING+987",
  };

  // Try json3 format first, then XML
  for (const fmt of ["json3", "srv3", ""]) {
    const url = fmt ? `${track.baseUrl}&fmt=${fmt}` : track.baseUrl;
    const response = await fetch(url, { headers });
    const body = await response.text();
    if (!body || body.length < 10) continue;

    if (fmt === "json3") {
      try {
        return parseJson3(body);
      } catch {
        continue;
      }
    } else {
      const segments = parseTimedText(body);
      if (segments.length > 0) return segments;
    }
  }

  return [];
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
