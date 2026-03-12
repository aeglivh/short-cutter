"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";
import { ShortSuggestion } from "@/lib/types";
import { loadEditorClipData } from "@/lib/storage";
import { saveVideo, loadVideo, clearVideo } from "@/lib/video-store";

type ExportFormat = "mp4" | "webm";
type AspectRatio = "original" | "9:16";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${String(s).padStart(2, "0")}.${ms}`;
}

function parseTime(str: string): number {
  const parts = str.split(":");
  if (parts.length === 2) {
    const [m, s] = parts;
    return parseInt(m) * 60 + parseFloat(s);
  }
  return parseFloat(str) || 0;
}

function shortTimeToSeconds(time: string): number {
  const parts = time.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function getExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext && ["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return `.${ext}`;
  return ".mp4";
}

const CLIP_COLORS = [
  { bg: "bg-blue-500/20", border: "border-blue-500/50", text: "text-blue-400", solid: "bg-blue-500" },
  { bg: "bg-emerald-500/20", border: "border-emerald-500/50", text: "text-emerald-400", solid: "bg-emerald-500" },
  { bg: "bg-violet-500/20", border: "border-violet-500/50", text: "text-violet-400", solid: "bg-violet-500" },
  { bg: "bg-pink-500/20", border: "border-pink-500/50", text: "text-pink-400", solid: "bg-pink-500" },
  { bg: "bg-amber-500/20", border: "border-amber-500/50", text: "text-amber-400", solid: "bg-amber-500" },
];

export default function EditorPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [startInput, setStartInput] = useState("0:00.0");
  const [endInput, setEndInput] = useState("0:00.0");
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("mp4");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<ShortSuggestion[]>([]);
  const [activeClip, setActiveClip] = useState<number | null>(null);
  const [restoringVideo, setRestoringVideo] = useState(true);
  const [sourceUrl, setSourceUrl] = useState<string | undefined>();
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("original");
  const [cropPosition, setCropPosition] = useState(50);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<"start" | "end" | "playhead" | null>(null);

  // Use refs so event listeners always see current values
  const endTimeRef = useRef(endTime);
  const startTimeRef = useRef(startTime);
  const durationRef = useRef(duration);
  endTimeRef.current = endTime;
  startTimeRef.current = startTime;
  durationRef.current = duration;

  // Load ffmpeg
  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => {
        setExportProgress(Math.round(progress * 100));
      });
      ffmpeg.on("log", ({ message }) => {
        console.log("[ffmpeg]", message);
      });
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      ffmpegRef.current = ffmpeg;
      setLoaded(true);
    } catch (e) {
      console.error("FFmpeg load error:", e);
      setError("Failed to load video processor. Make sure your browser supports SharedArrayBuffer.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore video from IndexedDB + load clips on mount
  useEffect(() => {
    const restore = async () => {
      const stored = await loadVideo();
      if (stored) {
        setVideoFile(stored);
        setVideoUrl(URL.createObjectURL(stored));
        loadFFmpeg();
      }
      setRestoringVideo(false);
    };
    restore();

    const clipData = loadEditorClipData();
    if (clipData.shorts.length > 0) {
      setClips(clipData.shorts);
      setSourceUrl(clipData.sourceUrl);
    }
  }, [loadFFmpeg]);

  // Clean up video URL on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  // Video event listeners — use refs to avoid stale closures
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      const et = endTimeRef.current;
      if (et > 0 && video.currentTime >= et) {
        video.pause();
        setPlaying(false);
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onSeeked = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => {
      setDuration(video.duration);
      durationRef.current = video.duration;
      setVideoWidth(video.videoWidth);
      setVideoHeight(video.videoHeight);
      if (endTimeRef.current === 0) {
        setEndTime(video.duration);
        setEndInput(formatTime(video.duration));
        endTimeRef.current = video.duration;
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("loadedmetadata", onLoadedMetadata);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  // Only re-attach when videoUrl changes (new video loaded)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(time, durationRef.current));
    video.currentTime = clamped;
    // currentTime will update via seeked event
  }, []);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      setError("Please select a video file.");
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setStartTime(0);
    setEndTime(0);
    endTimeRef.current = 0;
    startTimeRef.current = 0;
    setStartInput("0:00.0");
    setEndInput("0:00.0");
    setCurrentTime(0);
    setActiveClip(null);
    setError(null);
    loadFFmpeg();
    await saveVideo(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleClearFile = async () => {
    setVideoFile(null);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl("");
    setDuration(0);
    setStartTime(0);
    setEndTime(0);
    setStartInput("0:00.0");
    setEndInput("0:00.0");
    setActiveClip(null);
    await clearVideo();
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
    } else {
      if (video.currentTime >= endTimeRef.current || video.currentTime < startTimeRef.current) {
        video.currentTime = startTimeRef.current;
      }
      video.play();
    }
  };

  const setStart = () => {
    const t = videoRef.current?.currentTime ?? 0;
    setStartTime(t);
    setStartInput(formatTime(t));
    setActiveClip(null);
  };

  const setEnd = () => {
    const t = videoRef.current?.currentTime ?? 0;
    setEndTime(t);
    setEndInput(formatTime(t));
    setActiveClip(null);
  };

  const handleStartInputBlur = () => {
    const t = Math.max(0, Math.min(parseTime(startInput), endTimeRef.current - 0.1));
    setStartTime(t);
    setStartInput(formatTime(t));
    seekTo(t);
    setActiveClip(null);
  };

  const handleEndInputBlur = () => {
    const t = Math.max(startTimeRef.current + 0.1, Math.min(parseTime(endInput), durationRef.current));
    setEndTime(t);
    setEndInput(formatTime(t));
    setActiveClip(null);
  };

  // Select a clip from the shorts list
  const selectClip = useCallback((index: number) => {
    const clip = clips[index];
    if (!clip) return;
    const s = shortTimeToSeconds(clip.startTime);
    const e = shortTimeToSeconds(clip.endTime);
    setStartTime(s);
    setEndTime(e);
    startTimeRef.current = s;
    endTimeRef.current = e;
    setStartInput(formatTime(s));
    setEndInput(formatTime(e));
    setActiveClip(index);
    seekTo(s);
  }, [clips, seekTo]);

  // Timeline drag handling
  const getTimeFromMouse = useCallback((e: React.MouseEvent | MouseEvent) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || !durationRef.current) return 0;
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    return (x / rect.width) * durationRef.current;
  }, []);

  const handleTimelineMouseDown = useCallback((e: React.MouseEvent, handle: "start" | "end" | "playhead") => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = handle;

    const onMove = (ev: MouseEvent) => {
      const t = getTimeFromMouse(ev);
      if (draggingRef.current === "start") {
        const clamped = Math.max(0, Math.min(t, endTimeRef.current - 0.1));
        setStartTime(clamped);
        startTimeRef.current = clamped;
        setStartInput(formatTime(clamped));
        setActiveClip(null);
      } else if (draggingRef.current === "end") {
        const clamped = Math.max(startTimeRef.current + 0.1, Math.min(t, durationRef.current));
        setEndTime(clamped);
        endTimeRef.current = clamped;
        setEndInput(formatTime(clamped));
        setActiveClip(null);
      } else if (draggingRef.current === "playhead") {
        seekTo(t);
      }
    };

    const onUp = () => {
      draggingRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [getTimeFromMouse, seekTo]);

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (draggingRef.current) return;
    seekTo(getTimeFromMouse(e));
  }, [getTimeFromMouse, seekTo]);

  const previewTrim = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = startTime;
    video.play();
  };

  // Crop overlay drag on the video
  const handleCropDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = videoContainerRef.current;
    if (!container || videoWidth === 0 || videoHeight === 0) return;

    const targetW = Math.min(Math.round(videoHeight * 9 / 16), videoWidth);
    const cropWidthPct = targetW / videoWidth;

    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width;
      // x is where the center of the crop should be
      const halfCrop = cropWidthPct / 2;
      const centerClamped = Math.max(halfCrop, Math.min(x, 1 - halfCrop));
      const pos = (centerClamped - halfCrop) / (1 - cropWidthPct) * 100;
      setCropPosition(Math.max(0, Math.min(100, pos)));
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    // Also move on initial click
    onMove(e.nativeEvent);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [videoWidth, videoHeight]);

  // Export trimmed clip
  const handleExport = async () => {
    if (!ffmpegRef.current || !videoFile) return;
    setExporting(true);
    setExportProgress(0);
    setError(null);

    try {
      const ffmpeg = ffmpegRef.current;
      const inputName = "input" + getExtension(videoFile.name);
      const outputName = `clip.${exportFormat}`;

      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

      const clipDur = endTime - startTime;
      const args: string[] = [
        "-ss", startTime.toFixed(3),
        "-i", inputName,
        "-t", clipDur.toFixed(3),
      ];

      if (aspectRatio === "9:16" && videoWidth > 0 && videoHeight > 0) {
        const targetW = Math.round(videoHeight * 9 / 16);
        const cropW = Math.min(targetW, videoWidth);
        const maxX = videoWidth - cropW;
        const cropX = Math.round(maxX * (cropPosition / 100));
        // Use crop filter and re-encode
        args.push("-vf", `crop=${cropW}:${videoHeight}:${cropX}:0`);
        args.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", "23");
        args.push("-c:a", "aac", "-b:a", "128k");
      } else {
        args.push("-c", "copy");
      }

      args.push("-avoid_negative_ts", "make_zero", outputName);

      console.log("[ffmpeg] Running:", args.join(" "));
      const exitCode = await ffmpeg.exec(args);
      console.log("[ffmpeg] Exit code:", exitCode);

      if (exitCode !== 0) {
        throw new Error(`ffmpeg exited with code ${exitCode}`);
      }

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([new Uint8Array(data as Uint8Array)], {
        type: exportFormat === "mp4" ? "video/mp4" : "video/webm",
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      const clipLabel = activeClip !== null
        ? `_short${activeClip + 1}`
        : `_clip_${formatTime(startTime).replace(":", "m").replace(".", "s")}-${formatTime(endTime).replace(":", "m").replace(".", "s")}`;
      const ratioLabel = aspectRatio === "9:16" ? "_9x16" : "";
      a.download = `${videoFile.name.replace(/\.[^.]+$/, "")}${clipLabel}${ratioLabel}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);

      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch (e) {
      console.error("Export error:", e);
      setError(`Export failed: ${e instanceof Error ? e.message : "Unknown error"}. Check browser console for details.`);
    } finally {
      setExporting(false);
      setExportProgress(0);
    }
  };

  const clipDuration = endTime - startTime;
  const startPct = duration ? (startTime / duration) * 100 : 0;
  const endPct = duration ? (endTime / duration) * 100 : 100;
  const playheadPct = duration ? (currentTime / duration) * 100 : 0;

  // Crop overlay calculations
  const cropOverlay = aspectRatio === "9:16" && videoWidth > 0 && videoHeight > 0 ? (() => {
    const targetW = Math.min(Math.round(videoHeight * 9 / 16), videoWidth);
    const cropWidthPct = (targetW / videoWidth) * 100;
    const maxOffset = 100 - cropWidthPct;
    const leftPct = maxOffset * (cropPosition / 100);
    return { cropWidthPct, leftPct };
  })() : null;

  if (restoringVideo) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">
            <span className="text-orange-500">Clip</span> Cutter
          </h1>
          <p className="text-zinc-400 text-lg">
            Trim and export video clips right in your browser.
          </p>
          <div className="flex justify-center gap-4 mt-2">
            <a href="/" className="text-sm text-zinc-500 hover:text-orange-400 transition-colors">Short Finder</a>
            <a href="/transcript" className="text-sm text-zinc-500 hover:text-orange-400 transition-colors">Transcript Generator</a>
            <a href="/history" className="text-sm text-zinc-500 hover:text-orange-400 transition-colors">History</a>
          </div>
        </div>

        {/* Upload area */}
        {!videoFile && (
          <div className="space-y-4">
            {clips.length > 0 && (
              <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-center space-y-2">
                <p className="text-zinc-300 text-sm">
                  <span className="text-orange-400 font-medium">{clips.length} Short{clips.length !== 1 ? "s" : ""}</span> ready to cut
                </p>
                {sourceUrl && (
                  <p className="text-zinc-500 text-xs">
                    From: <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-orange-400 underline transition-colors">{sourceUrl}</a>
                  </p>
                )}
                <p className="text-zinc-500 text-xs">Drop the source video below to start cutting.</p>
              </div>
            )}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              className={`border-2 border-dashed rounded-xl p-16 text-center transition-colors cursor-pointer ${
                dragOver ? "border-orange-500 bg-orange-500/5" : "border-zinc-700 hover:border-zinc-500"
              }`}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input id="file-input" type="file" accept="video/*" onChange={handleFileInput} className="hidden" />
              <svg className="mx-auto mb-4 text-zinc-500" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <p className="text-zinc-400 text-lg mb-1">Drop a video file here</p>
              <p className="text-zinc-600 text-sm">or click to browse — MP4, WebM, MOV supported</p>
            </div>
          </div>
        )}

        {/* Video player + controls */}
        {videoFile && (
          <div className="space-y-6">
            {/* File info + change */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-zinc-400 text-sm font-mono">{videoFile.name}</span>
                <span className="text-zinc-600 text-xs">({(videoFile.size / 1024 / 1024).toFixed(1)} MB)</span>
              </div>
              <button onClick={handleClearFile} className="text-sm text-zinc-500 hover:text-orange-400 transition-colors cursor-pointer">
                Change file
              </button>
            </div>

            {/* Aspect ratio controls — above video so you see the overlay */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 uppercase tracking-wider">Aspect</span>
              <div className="flex gap-1">
                {(["original", "9:16"] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors cursor-pointer ${
                      aspectRatio === ratio ? "bg-orange-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {ratio === "original" ? "Original" : "9:16"}
                  </button>
                ))}
              </div>
              {cropOverlay && (
                <span className="text-xs text-zinc-600 ml-2">Drag the crop overlay on the video to adjust</span>
              )}
            </div>

            {/* Video with crop overlay + progress bar */}
            <div ref={videoContainerRef} className="bg-black rounded-lg overflow-hidden relative">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full max-h-[60vh] mx-auto block"
                onClick={togglePlay}
              />
              {/* 9:16 crop overlay — draggable */}
              {cropOverlay && (
                <>
                  {cropOverlay.leftPct > 0.1 && (
                    <div
                      className="absolute top-0 bottom-0 left-0 bg-black/60 cursor-ew-resize"
                      style={{ width: `${cropOverlay.leftPct}%` }}
                      onMouseDown={handleCropDrag}
                    />
                  )}
                  {cropOverlay.leftPct + cropOverlay.cropWidthPct < 99.9 && (
                    <div
                      className="absolute top-0 bottom-0 right-0 bg-black/60 cursor-ew-resize"
                      style={{ width: `${100 - cropOverlay.leftPct - cropOverlay.cropWidthPct}%` }}
                      onMouseDown={handleCropDrag}
                    />
                  )}
                  <div
                    className="absolute top-0 bottom-0 border-x-2 border-orange-500/70 cursor-ew-resize"
                    style={{ left: `${cropOverlay.leftPct}%`, width: `${cropOverlay.cropWidthPct}%` }}
                    onMouseDown={handleCropDrag}
                  />
                </>
              )}
              {/* Progress bar on video */}
              {duration > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40 group hover:h-3 transition-all cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width;
                    seekTo(x * duration);
                  }}
                >
                  {/* Selected clip region */}
                  <div
                    className="absolute top-0 bottom-0 bg-orange-500/30"
                    style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
                  />
                  {/* Playback progress */}
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-white/80 transition-[width] duration-100"
                    style={{ width: `${playheadPct}%` }}
                  />
                </div>
              )}
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={togglePlay}
                className="w-10 h-10 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors cursor-pointer"
              >
                {playing ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <span className="text-zinc-400 text-sm font-mono min-w-[70px] text-center">{formatTime(currentTime)}</span>
              <span className="text-zinc-600 text-sm">/</span>
              <span className="text-zinc-500 text-sm font-mono min-w-[70px] text-center">{formatTime(duration)}</span>
            </div>

            {/* Timeline */}
            <div className="space-y-2">
              <div
                ref={timelineRef}
                className="relative h-14 bg-zinc-900 rounded-lg cursor-pointer select-none"
                onClick={handleTimelineClick}
              >
                {/* Short clip markers */}
                {duration > 0 && clips.map((clip, i) => {
                  const cs = shortTimeToSeconds(clip.startTime);
                  const ce = shortTimeToSeconds(clip.endTime);
                  const leftPct = (cs / duration) * 100;
                  const widthPct = ((ce - cs) / duration) * 100;
                  const color = CLIP_COLORS[i % CLIP_COLORS.length];
                  const isActive = activeClip === i;
                  return (
                    <div
                      key={i}
                      className={`absolute bottom-0 h-3 rounded-b cursor-pointer transition-all ${color.bg} border-t-2 ${color.border} ${isActive ? "opacity-100" : "opacity-60 hover:opacity-90"}`}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      onClick={(e) => { e.stopPropagation(); selectClip(i); }}
                      title={`Short ${i + 1}: ${clip.title}`}
                    >
                      <span className={`absolute -top-5 left-1 text-[9px] font-bold ${color.text} whitespace-nowrap pointer-events-none`}>
                        {i + 1}
                      </span>
                    </div>
                  );
                })}

                {/* Selected region */}
                <div
                  className="absolute top-0 bottom-3 bg-orange-500/20 border-y border-orange-500/40"
                  style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
                />

                {/* Start handle */}
                <div
                  className="absolute top-0 bottom-3 w-1.5 bg-orange-500 cursor-ew-resize z-10 hover:bg-orange-400 rounded-l"
                  style={{ left: `${startPct}%` }}
                  onMouseDown={(e) => handleTimelineMouseDown(e, "start")}
                >
                  <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-4 h-8 bg-orange-500 rounded-sm flex items-center justify-center hover:bg-orange-400">
                    <svg width="6" height="14" viewBox="0 0 6 14" className="text-white">
                      <line x1="1.5" y1="2" x2="1.5" y2="12" stroke="currentColor" strokeWidth="1" />
                      <line x1="4.5" y1="2" x2="4.5" y2="12" stroke="currentColor" strokeWidth="1" />
                    </svg>
                  </div>
                </div>

                {/* End handle */}
                <div
                  className="absolute top-0 bottom-3 w-1.5 bg-orange-500 cursor-ew-resize z-10 hover:bg-orange-400 rounded-r"
                  style={{ left: `${endPct}%`, transform: "translateX(-100%)" }}
                  onMouseDown={(e) => handleTimelineMouseDown(e, "end")}
                >
                  <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-4 h-8 bg-orange-500 rounded-sm flex items-center justify-center hover:bg-orange-400">
                    <svg width="6" height="14" viewBox="0 0 6 14" className="text-white">
                      <line x1="1.5" y1="2" x2="1.5" y2="12" stroke="currentColor" strokeWidth="1" />
                      <line x1="4.5" y1="2" x2="4.5" y2="12" stroke="currentColor" strokeWidth="1" />
                    </svg>
                  </div>
                </div>

                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white z-20 cursor-ew-resize"
                  style={{ left: `${playheadPct}%` }}
                  onMouseDown={(e) => handleTimelineMouseDown(e, "playhead")}
                >
                  <div className="absolute -left-1.5 -top-1 w-3.5 h-3.5 bg-white rounded-full" />
                </div>
              </div>
            </div>

            {/* Clips panel */}
            {clips.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-400">Suggested Shorts</h3>
                  <button
                    onClick={() => { setClips([]); setActiveClip(null); }}
                    className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <div className="grid gap-2">
                  {clips.map((clip, i) => {
                    const color = CLIP_COLORS[i % CLIP_COLORS.length];
                    const isActive = activeClip === i;
                    return (
                      <button
                        key={i}
                        onClick={() => selectClip(i)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer ${
                          isActive ? "bg-zinc-800 border border-zinc-600" : "bg-zinc-900 border border-zinc-800 hover:border-zinc-700"
                        }`}
                      >
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white ${color.solid}`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{clip.title}</p>
                          <p className="text-xs text-zinc-500 font-mono">{clip.startTime} — {clip.endTime}</p>
                        </div>
                        {isActive && (
                          <span className="text-[10px] uppercase tracking-wider text-orange-400 font-medium">Selected</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Trim controls */}
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-1">
                <label className="text-xs text-zinc-500 uppercase tracking-wider">Start</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={startInput}
                    onChange={(e) => setStartInput(e.target.value)}
                    onBlur={handleStartInputBlur}
                    onKeyDown={(e) => e.key === "Enter" && handleStartInputBlur()}
                    className="w-24 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm font-mono text-center focus:outline-none focus:border-orange-500"
                  />
                  <button onClick={setStart} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors cursor-pointer" title="Set start to current position">
                    Set
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-500 uppercase tracking-wider">End</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={endInput}
                    onChange={(e) => setEndInput(e.target.value)}
                    onBlur={handleEndInputBlur}
                    onKeyDown={(e) => e.key === "Enter" && handleEndInputBlur()}
                    className="w-24 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm font-mono text-center focus:outline-none focus:border-orange-500"
                  />
                  <button onClick={setEnd} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors cursor-pointer" title="Set end to current position">
                    Set
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 rounded-lg">
                <span className="text-xs text-zinc-500">Duration:</span>
                <span className="text-sm font-mono text-orange-400">{formatTime(Math.max(0, clipDuration))}</span>
              </div>

              <button onClick={previewTrim} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors cursor-pointer">
                Preview clip
              </button>
            </div>

            {/* Export section */}
            <div className="border-t border-zinc-800 pt-6 mt-6 space-y-4">
              <div className="flex items-end gap-4 flex-wrap">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-500 uppercase tracking-wider">Format</label>
                  <div className="flex gap-1">
                    {(["mp4", "webm"] as ExportFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setExportFormat(fmt)}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                          exportFormat === fmt ? "bg-orange-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleExport}
                  disabled={!loaded || exporting || clipDuration <= 0}
                  className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {exporting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Exporting {exportProgress}%
                    </>
                  ) : loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading processor...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      Export clip {aspectRatio === "9:16" ? "(9:16)" : ""}
                    </>
                  )}
                </button>
              </div>

              {exporting && (
                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${exportProgress}%` }} />
                </div>
              )}

              {aspectRatio === "9:16" && (
                <p className="text-xs text-zinc-600">
                  9:16 export requires re-encoding — will be slower than original ratio.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-8 p-4 bg-red-950 border border-red-800 rounded-lg text-red-300 text-center">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="mt-20 text-center text-xs text-zinc-600">
          Built for Studio Egli — powered by ffmpeg.wasm
        </div>
      </div>
    </div>
  );
}
