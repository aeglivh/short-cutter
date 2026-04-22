import Anthropic from "@anthropic-ai/sdk";
import { ShortSuggestion, TranscriptSegment } from "./types";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert content strategist for YouTube Shorts and short-form video.

You will receive a timestamped transcript from a long-form YouTube video. Each line is one transcript segment (usually one sentence), prefixed with its start timestamp. Your job is to identify the 3-5 best moments that would make compelling YouTube Shorts (15-60 seconds each).

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

BOUNDARY RULES — this is critical, complete thoughts are non-negotiable:
- startTime MUST be the timestamp of a transcript line that begins a complete sentence / thought — typically the line that opens the hook or sets up the payoff. Never start mid-sentence or mid-clause.
- endTime MUST be AFTER the final word of the last complete sentence in the clip. Use the timestamp of the NEXT transcript line (the one that starts just after the clip's last sentence ends), so the audio/speech can finish cleanly. Never end on a conjunction, cut off a speaker mid-word, or chop off the payoff.
- If a sentence is split across two transcript lines, include both — don't clip in the middle.
- Prefer including 1-2 seconds of natural breathing room on each side over cutting tight. A clip that runs 5 seconds long with a complete thought is MUCH better than a clip cut to exactly 60 seconds with a half-sentence.
- Re-read your chosen startTime and endTime as full sentences before finalizing. If either boundary would leave a listener confused or waiting for a word that never comes, move it.

For each Short, respond with this exact JSON structure:

{
  "shorts": [
    {
      "title": "YouTube Shorts title under 100 chars, include a relevant keyword for the topic",
      "hookText": "On-screen text for the first 2 seconds. Punchy, max 10 words. Creates curiosity.",
      "description": "YouTube description, 1-2 sentences + 3-5 relevant hashtags for the niche",
      "startTime": "MM:SS",
      "endTime": "MM:SS",
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

/**
 * Snap a clip's start/end to the nearest segment boundaries that preserve
 * complete thoughts. Start snaps to the beginning of the segment containing
 * startTime. End snaps to the end of the segment containing endTime (i.e.
 * after the last word is actually spoken).
 */
function snapToSegmentBoundaries(
  short: ShortSuggestion,
  segments: TranscriptSegment[]
): ShortSuggestion {
  if (segments.length === 0) return short;

  const startSec = timeToSeconds(short.startTime);
  const endSec = timeToSeconds(short.endTime);

  // Find the segment that contains (or is closest to) startSec — snap start DOWN
  // to the beginning of that segment so the sentence is heard in full.
  let startSegIdx = segments.findIndex(s => s.offset <= startSec && startSec < s.offset + s.duration);
  if (startSegIdx === -1) {
    // No segment contains startSec — pick the last segment that starts at or before it.
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i].offset <= startSec) { startSegIdx = i; break; }
    }
    if (startSegIdx === -1) startSegIdx = 0;
  }

  // Find the segment containing endSec — snap end UP to the end of that segment
  // so the final sentence completes cleanly.
  let endSegIdx = segments.findIndex(s => s.offset <= endSec && endSec < s.offset + s.duration);
  if (endSegIdx === -1) {
    // No segment contains endSec — pick the first segment that ends at or after it.
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].offset + segments[i].duration >= endSec) { endSegIdx = i; break; }
    }
    if (endSegIdx === -1) endSegIdx = segments.length - 1;
  }

  // Ensure end comes after start, and extend by a small tail pad so the audio
  // isn't clipped on the final word.
  if (endSegIdx < startSegIdx) endSegIdx = startSegIdx;

  const snappedStart = Math.max(0, segments[startSegIdx].offset);
  const endSeg = segments[endSegIdx];
  const snappedEnd = endSeg.offset + Math.max(endSeg.duration, 1);

  return {
    ...short,
    startTime: secondsToTime(snappedStart),
    endTime: secondsToTime(snappedEnd),
  };
}

export async function analyzeTranscript(
  formattedTranscript: string,
  segments: TranscriptSegment[] = []
): Promise<ShortSuggestion[]> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
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
  const shorts = parsed.shorts as ShortSuggestion[];

  if (segments.length === 0) return shorts;
  return shorts.map(s => snapToSegmentBoundaries(s, segments));
}
