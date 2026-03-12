import { ShortSuggestion, TranscriptSegment } from "./types";

const STORAGE_KEY = "short-cutter-results";

export interface StoredResult {
  videoId: string;
  url: string;
  shorts: ShortSuggestion[];
  transcript: TranscriptSegment[];
  timestamp: number;
}

interface StorageData {
  results: Record<string, StoredResult>;
}

function getStorage(): StorageData {
  if (typeof window === "undefined") return { results: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { results: {} };
  } catch {
    return { results: {} };
  }
}

function setStorage(data: StorageData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function saveResult(
  videoId: string,
  url: string,
  shorts: ShortSuggestion[],
  transcript: TranscriptSegment[]
) {
  const data = getStorage();

  // Keep max 20 results, remove oldest if needed
  const entries = Object.entries(data.results);
  if (entries.length >= 20) {
    const oldest = entries.sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    delete data.results[oldest[0]];
  }

  data.results[videoId] = { videoId, url, shorts, transcript, timestamp: Date.now() };
  setStorage(data);
}

export function loadResult(
  videoId: string
): { shorts: ShortSuggestion[]; transcript: TranscriptSegment[] } | null {
  const data = getStorage();
  const result = data.results[videoId];
  if (!result) return null;
  return { shorts: result.shorts, transcript: result.transcript };
}

export function getAllResults(): StoredResult[] {
  const data = getStorage();
  return Object.entries(data.results)
    .map(([id, result]) => ({ ...result, videoId: id }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function clearResult(videoId: string) {
  const data = getStorage();
  delete data.results[videoId];
  setStorage(data);
}

// Editor clip queue — pass shorts to the clip cutter
const EDITOR_CLIPS_KEY = "short-cutter-editor-clips";

export function saveEditorClips(shorts: ShortSuggestion[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(EDITOR_CLIPS_KEY, JSON.stringify(shorts));
  } catch {
    // ignore
  }
}

export function loadEditorClips(): ShortSuggestion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EDITOR_CLIPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
