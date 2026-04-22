import Anthropic from "@anthropic-ai/sdk";
import { ShortSuggestion, TranscriptSegment } from "./types";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert content strategist for YouTube Shorts and short-form video.

You will receive a timestamped transcript from a long-form YouTube video. Each line is one transcript segment, prefixed with its start timestamp. IMPORTANT: these transcripts come from YouTube auto-captions and may have no punctuation, odd line breaks, or be chunked in arbitrary ~10-second intervals. The line breaks do NOT reliably correspond to sentence boundaries — YOU are responsible for identifying where real thoughts begin and end.

Your job is to identify the 3-5 best moments that would make compelling YouTube Shorts (15-60 seconds each).

First, figure out the topic and niche from the transcript. Then find the most engaging, shareable moments.

PRIORITIZE moments that:
- Show a transformation, reveal, or result (before/after, problem→solution, buildup→payoff)
- Contain a specific insight, tip, trick, or "aha moment" viewers can immediately use
- Have a natural hook in the first few seconds — something surprising, controversial, or curiosity-inducing
- Are self-contained enough to make sense without watching the full video
- Would make someone stop scrolling and watch to the end
- Have emotional peaks — excitement, humor, shock, inspiration

AVOID:
- Intro/outro segments ("like and subscribe", "see you next time", channel plugs)
- Segments that are purely setup or context without any payoff
- Generic statements that don't teach or reveal anything specific
- Moments that require too much prior context to understand
- Long pauses, filler words, or low-energy segments

BOUNDARY RULES — complete thoughts are non-negotiable:
- For each clip, you must provide startsWith and endsWith quotes — EXACT VERBATIM text copied word-for-word from the transcript. We use these quotes to locate the real word-level cut points, so they must match the transcript exactly (same words, same order; case and punctuation don't matter).
- startsWith = the first 8-15 words of the clip, starting at a natural thought opening (a question being asked, a statement being introduced, "So...", "The trick is...", etc.). Never start mid-clause or mid-word.
- endsWith = the last 8-15 words of the clip, ending at a natural thought completion (a conclusion, a resolved idea, a punchline, a closing statement). Never end on a conjunction ("and", "but", "because...") or mid-word.
- Re-read your startsWith and endsWith as written, as if you were hearing the clip cold. If either would leave a listener confused, waiting for a word that never comes, or missing context needed to understand the middle, move the boundary to a better spot.
- Include the setup that makes the payoff land. If the payoff is "that's why you should never paint a ceiling white", the clip MUST include whatever sets up that claim earlier. Do not start on the payoff line with no setup.
- startTime and endTime are your best-guess MM:SS timestamps for those boundaries (we will correct them using the quotes), but the quotes are what matter most.

For each Short, respond with this exact JSON structure:

{
  "shorts": [
    {
      "title": "YouTube Shorts title under 100 chars, include a relevant keyword for the topic",
      "hookText": "On-screen text for the first 2 seconds. Punchy, max 10 words. Creates curiosity.",
      "description": "YouTube description, 1-2 sentences + 3-5 relevant hashtags for the niche",
      "startTime": "MM:SS",
      "endTime": "MM:SS",
      "startsWith": "exact verbatim opening phrase from transcript, 8-15 words",
      "endsWith": "exact verbatim closing phrase from transcript, 8-15 words",
      "reasoning": "One sentence explaining why this moment works as a Short",
      "viralityScore": 85
    }
  ]
}

VIRALITY SCORE (1-100):
Score each Short on its viral potential. Consider:
- Hook strength (does it grab attention in <2 seconds?)
- Emotional intensity (surprise, humor, awe, controversy)
- Shareability (would viewers send this to friends?)
- Completion rate potential (will viewers watch to the end?)
- Comment bait (does it spark discussion or debate?)
Be honest and specific — not everything is a 90+. Most clips land 50-75. Reserve 80+ for truly exceptional moments.

Respond with ONLY the JSON object. No markdown, no code fences, no extra text.`;

interface RawShortSuggestion extends ShortSuggestion {
  startsWith?: string;
  endsWith?: string;
}

function timeToSeconds(time: string): number {
  const parts = time.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function secondsToTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

interface ConcatIndex {
  text: string;
  segmentAt: number[];
}

function buildIndex(segments: TranscriptSegment[]): ConcatIndex {
  const parts: string[] = [];
  const segmentAt: number[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (i > 0) {
      parts.push(" ");
      segmentAt.push(i);
    }
    const norm = normalize(segments[i].text);
    for (let c = 0; c < norm.length; c++) segmentAt.push(i);
    parts.push(norm);
  }
  return { text: parts.join(""), segmentAt };
}

/**
 * Best-effort match: try the full quote, then progressively shorter prefixes
 * (or suffixes for endsWith). Returns the segment index containing the match.
 */
function findSegmentForQuote(
  index: ConcatIndex,
  quote: string,
  which: "start" | "end"
): number | null {
  const normFull = normalize(quote);
  if (!normFull) return null;

  const words = normFull.split(" ").filter(Boolean);
  if (words.length === 0) return null;

  const minWords = 3;
  for (let len = words.length; len >= minWords; len--) {
    const slice = which === "start" ? words.slice(0, len) : words.slice(words.length - len);
    const needle = slice.join(" ");
    const pos = index.text.indexOf(needle);
    if (pos !== -1) {
      const charIdx = which === "start" ? pos : pos + needle.length - 1;
      const segIdx = index.segmentAt[charIdx];
      return typeof segIdx === "number" ? segIdx : null;
    }
  }
  return null;
}

/**
 * Resolve a clip's start/end using verbatim quote matching against the
 * transcript. Falls back to snapping the model-given MM:SS timestamp to the
 * containing segment if the quote can't be found.
 */
function resolveBoundaries(
  short: RawShortSuggestion,
  segments: TranscriptSegment[],
  index: ConcatIndex
): ShortSuggestion {
  if (segments.length === 0) {
    const { startsWith: _sw, endsWith: _ew, ...rest } = short;
    return rest;
  }

  const segEnd = (i: number) => {
    const s = segments[i];
    // Prefer the next segment's offset if it's reasonable — durations from
    // Supadata are often underestimated, causing tails to clip.
    const next = segments[i + 1];
    const byDuration = s.offset + Math.max(s.duration, 1);
    const byNext = next ? next.offset : byDuration;
    return Math.max(byDuration, byNext);
  };

  let startSegIdx: number | null = short.startsWith
    ? findSegmentForQuote(index, short.startsWith, "start")
    : null;
  let endSegIdx: number | null = short.endsWith
    ? findSegmentForQuote(index, short.endsWith, "end")
    : null;

  // Fallbacks when quote match fails — use the model's MM:SS and snap to segment.
  if (startSegIdx === null) {
    const startSec = timeToSeconds(short.startTime);
    startSegIdx = segments.findIndex(s => s.offset <= startSec && startSec < s.offset + s.duration);
    if (startSegIdx === -1) {
      for (let i = segments.length - 1; i >= 0; i--) {
        if (segments[i].offset <= startSec) { startSegIdx = i; break; }
      }
      if (startSegIdx === -1 || startSegIdx === null) startSegIdx = 0;
    }
  }
  if (endSegIdx === null) {
    const endSec = timeToSeconds(short.endTime);
    endSegIdx = segments.findIndex(s => s.offset <= endSec && endSec < s.offset + s.duration);
    if (endSegIdx === -1) {
      for (let i = 0; i < segments.length; i++) {
        if (segments[i].offset + segments[i].duration >= endSec) { endSegIdx = i; break; }
      }
      if (endSegIdx === -1 || endSegIdx === null) endSegIdx = segments.length - 1;
    }
  }

  if (endSegIdx < startSegIdx) endSegIdx = startSegIdx;

  const start = Math.max(0, segments[startSegIdx].offset);
  const end = segEnd(endSegIdx);

  const { startsWith: _sw, endsWith: _ew, ...rest } = short;
  return {
    ...rest,
    startTime: secondsToTime(start),
    endTime: secondsToTime(end),
  };
}

export async function analyzeTranscript(
  formattedTranscript: string,
  segments: TranscriptSegment[] = []
): Promise<ShortSuggestion[]> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is the timestamped transcript from a YouTube video. Find the best 3-5 moments for Shorts:\n\n${formattedTranscript}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  const parsed = JSON.parse(text);
  const rawShorts = parsed.shorts as RawShortSuggestion[];

  if (segments.length === 0) {
    return rawShorts.map(({ startsWith: _sw, endsWith: _ew, ...rest }) => rest);
  }

  const index = buildIndex(segments);
  return rawShorts.map(s => resolveBoundaries(s, segments, index));
}
