export interface TranscriptSegment {
  text: string;
  offset: number; // seconds
  duration: number; // seconds
}

export interface ShortSuggestion {
  title: string;
  hookText: string;
  description: string;
  startTime: string; // "MM:SS"
  endTime: string; // "MM:SS"
  reasoning: string;
}

export interface AnalyzeResponse {
  shorts: ShortSuggestion[];
  transcript: TranscriptSegment[];
  error?: string;
}
