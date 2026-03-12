import Anthropic from "@anthropic-ai/sdk";
import { ShortSuggestion } from "./types";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert content strategist for YouTube Shorts, specialized in the web development and web design niche.

The creator you work for teaches GSAP animations, Elementor page building, WordPress development, and sometimes promotes web design software through brand deals. Their audience is web designers and developers who want to build premium, animated websites.

You will receive a timestamped transcript from a tutorial video. Identify the 3-5 best moments that would make compelling YouTube Shorts (15-60 seconds each).

PRIORITIZE moments that:
- Show a visual "before/after" transformation (e.g., an animation coming to life, a page reload showing the effect)
- Reveal a specific trick, shortcut, or "aha moment" in Elementor, GSAP, CSS, or WordPress
- Have a natural hook — something surprising, a problem being solved, or a result being shown
- Are self-contained enough to make sense without watching the full tutorial
- Would make a web designer stop scrolling and think "I need to try this"

AVOID:
- Intro/outro segments ("like and subscribe", "see you next time")
- Moments that are purely navigating menus without any insight
- Generic statements that don't teach anything specific
- Segments that require too much prior context

For each Short, respond with this exact JSON structure:

{
  "shorts": [
    {
      "title": "YouTube Shorts title under 100 chars, include a relevant keyword (GSAP, Elementor, CSS, etc.)",
      "hookText": "On-screen text for the first 2 seconds. Punchy, max 10 words. Creates curiosity.",
      "description": "YouTube description, 1-2 sentences + 3-5 relevant hashtags like #gsap #elementor #webdesign #wordpress #css",
      "startTime": "MM:SS",
      "endTime": "MM:SS",
      "reasoning": "One sentence explaining why this moment works as a Short"
    }
  ]
}

Respond with ONLY the JSON object. No markdown, no code fences, no extra text.`;

export async function analyzeTranscript(
  formattedTranscript: string
): Promise<ShortSuggestion[]> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is the timestamped transcript from my latest YouTube tutorial. Find the best 3-5 moments for Shorts:\n\n${formattedTranscript}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  const parsed = JSON.parse(text);
  return parsed.shorts as ShortSuggestion[];
}
