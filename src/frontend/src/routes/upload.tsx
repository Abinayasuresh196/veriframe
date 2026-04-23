import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Film,
  Loader2,
  RefreshCw,
  Terminal,
  UploadCloud,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuthContext } from "../contexts/AuthContext";
import { useSubmitVideoAnalysis } from "../hooks/useAnalysis";
import { useAnalysisStore } from "../stores/analysisStore";

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/upload")({
  component: UploadPageComponent,
}) as any;

const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
const ACCEPTED_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
];
const ACCEPTED_DISPLAY = "MP4, MOV, AVI, WebM";

type UploadPhase =
  | "idle"
  | "file-selected"
  | "uploading"
  | "initializing"
  | "cnn"
  | "rnn"
  | "report"
  | "complete"
  | "error";

const PROCESSING_STEPS: { phase: UploadPhase; label: string; sub: string }[] = [
  {
    phase: "uploading",
    label: "Uploading...",
    sub: "Transferring video to analysis server",
  },
  {
    phase: "initializing",
    label: "Initializing Analysis...",
    sub: "Preparing forensic pipeline",
  },
  {
    phase: "cnn",
    label: "Running CNN Frame Extraction...",
    sub: "Extracting spatial features per frame",
  },
  {
    phase: "rnn",
    label: "Applying RNN Temporal Model...",
    sub: "Modeling temporal dependencies",
  },
  {
    phase: "report",
    label: "Generating Report...",
    sub: "Compiling forensic findings",
  },
];

const PHASE_ORDER: UploadPhase[] = [
  "uploading",
  "initializing",
  "cnn",
  "rnn",
  "report",
  "complete",
];

// ─── Terminal Log System ────────────────────────────────────────────────────

type LogLevel = "info" | "success" | "warn" | "error" | "dim" | "system";

interface TerminalLog {
  id: number;
  ts: string;
  level: LogLevel;
  msg: string;
}

function nowTs() {
  return new Date().toISOString().replace("T", " ").slice(0, 23);
}

let _logId = 0;
function mkLog(level: LogLevel, msg: string): TerminalLog {
  return { id: _logId++, ts: nowTs(), level, msg };
}

const STARTUP_LOGS: TerminalLog[] = [
  mkLog("system", "VeriFrame Backend v2.4.1 starting up..."),
  mkLog("info",   "Loading environment: development"),
  mkLog("info",   "Binding to localhost:8000"),
  mkLog("success","MongoDB connected — localhost:27017/veriframe_db"),
  mkLog("dim",    "  ↳ Pool: 5 connections ready"),
  mkLog("success","Redis cache connected — localhost:6379"),
  mkLog("info",   "Loading model weights: cnn_resnet50_v3.pth (487 MB)"),
  mkLog("info",   "Loading model weights: rnn_lstm_temporal_v2.pth (124 MB)"),
  mkLog("success","Models loaded to GPU [CUDA:0 — NVIDIA RTX 4090, 24 GB VRAM]"),
  mkLog("success","FastAPI server ready — http://localhost:8000"),
  mkLog("dim",    "───────────────────────────────────────────────────"),
];

const PHASE_LOGS: Record<UploadPhase, TerminalLog[]> = {
  idle:            [],
  "file-selected": [],
  uploading: [
    mkLog("info",   "POST /api/v1/analysis/submit  — 200 OK"),
    mkLog("info",   "Received multipart payload — validating MIME type"),
    mkLog("success","File validation passed: video/mp4"),
    mkLog("info",   "Uploading to Cloudinary CDN..."),
    mkLog("success","Cloudinary upload complete — secure_url assigned"),
    mkLog("info",   "Saving metadata to MongoDB collection: analyses"),
    mkLog("success","Document inserted — status: QUEUED"),
  ],
  initializing: [
    mkLog("info",   "Worker[0] picked up job from queue"),
    mkLog("info",   "Decoding video stream with FFmpeg 6.1"),
    mkLog("dim",    "  ↳ codec: h264, resolution: 1920x1080, fps: 30"),
    mkLog("info",   "Allocating VRAM buffers for frame batch (32 frames)"),
    mkLog("success","Pipeline initialized — status: PROCESSING"),
    mkLog("info",   "Updating MongoDB document — status → PROCESSING"),
  ],
  cnn: [
    mkLog("info",   "CNN pipeline start — ResNet50 + FPN backbone"),
    mkLog("dim",    "  ↳ Batch 1/8  — frames 0–31"),
    mkLog("dim",    "  ↳ Batch 2/8  — frames 32–63"),
    mkLog("dim",    "  ↳ Batch 3/8  — frames 64–95"),
    mkLog("dim",    "  ↳ Batch 4/8  — frames 96–127"),
    mkLog("dim",    "  ↳ Batch 5/8  — frames 128–159"),
    mkLog("dim",    "  ↳ Batch 6/8  — frames 160–191"),
    mkLog("dim",    "  ↳ Batch 7/8  — frames 192–223"),
    mkLog("dim",    "  ↳ Batch 8/8  — frames 224–255"),
    mkLog("success","CNN extraction complete — 256 feature maps stored"),
    mkLog("info",   "Running face mesh detector (MediaPipe v0.10)"),
    mkLog("dim",    "  ↳ 47 faces detected across 256 frames"),
    mkLog("info",   "Color anomaly scan — running LAB histogram analysis"),
  ],
  rnn: [
    mkLog("info",   "RNN temporal model — LSTM seq_len=256"),
    mkLog("dim",    "  ↳ Forward pass epoch: 1/3"),
    mkLog("dim",    "  ↳ Forward pass epoch: 2/3"),
    mkLog("dim",    "  ↳ Forward pass epoch: 3/3"),
    mkLog("info",   "Evaluating temporal inconsistency score..."),
    mkLog("info",   "Checking audio/video sync drift (FFT phase correlation)"),
    mkLog("info",   "Computing compression artifact tensor map"),
    mkLog("success","Temporal model pass complete — confidence: 94.3%"),
    mkLog("info",   "Frame suspicion scores — writing to analysis payload"),
  ],
  report: [
    mkLog("info",   "Aggregating forensic signals (6 layers)"),
    mkLog("info",   "Computing overall risk score (weighted ensemble)"),
    mkLog("success","Risk score computed"),
    mkLog("info",   "Finalizing verdict classifier..."),
    mkLog("success","━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"),
    mkLog("success","  FINAL VERDICT determined"),
    mkLog("success","━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"),
    mkLog("info",   "Saving forensic report to MongoDB..."),
    mkLog("success","Document updated — status: COMPLETE"),
    mkLog("info",   "POST /api/v1/analysis/result — 200 OK"),
  ],
  complete: [],
  error: [
    mkLog("error",  "Unhandled exception in analysis worker"),
    mkLog("error",  "MongoDB document status → FAILED"),
  ],
};

// Level styling
function logColor(level: LogLevel): string {
  switch (level) {
    case "success": return "text-emerald-400";
    case "warn":    return "text-yellow-400";
    case "error":   return "text-red-400";
    case "dim":     return "text-slate-500";
    case "system":  return "text-sky-400";
    default:        return "text-slate-300";
  }
}
function logPrefix(level: LogLevel): string {
  switch (level) {
    case "success": return "✓";
    case "warn":    return "⚠";
    case "error":   return "✗";
    case "system":  return "»";
    default:        return "·";
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

interface VideoMeta {
  duration: number | null;
  objectUrl: string;
}

function useVideoMeta(file: File | null): VideoMeta {
  const [meta, setMeta] = useState<VideoMeta>({
    duration: null,
    objectUrl: "",
  });

  useEffect(() => {
    if (!file) {
      setMeta({ duration: null, objectUrl: "" });
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setMeta({
        duration: Number.isFinite(video.duration) ? video.duration : null,
        objectUrl: url,
      });
    };
    video.onerror = () => setMeta({ duration: null, objectUrl: url });
    video.src = url;
    // Removed revocation to prevent black screen on navigation
  }, [file]);

  return meta;
}

// Animated step indicator
function StepRow({
  step,
  index,
  activeIndex,
}: {
  step: (typeof PROCESSING_STEPS)[number];
  index: number;
  activeIndex: number;
}) {
  const isDone = index < activeIndex;
  const isActive = index === activeIndex;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className={`flex items-start gap-3 py-2.5 px-3 rounded-lg transition-smooth ${
        isActive
          ? "bg-primary/10 border border-primary/25"
          : isDone
            ? "bg-muted/30 border border-border"
            : "border border-transparent opacity-40"
      }`}
    >
      <div className="mt-0.5 flex-shrink-0">
        {isDone ? (
          <CheckCircle2 size={16} className="text-real" />
        ) : isActive ? (
          <Loader2 size={16} className="text-primary animate-spin" />
        ) : (
          <div className="w-4 h-4 rounded-full border-2 border-border" />
        )}
      </div>
      <div className="min-w-0">
        <p
          className={`font-mono text-sm font-semibold leading-tight ${isActive ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"}`}
        >
          {step.label}
        </p>
        {(isActive || isDone) && (
          <p className="font-mono text-xs text-muted-foreground mt-0.5">
            {step.sub}
          </p>
        )}
      </div>
    </motion.div>
  );
}

function UploadPageContent() {
  const navigate = useNavigate();
  const submitMutation = useSubmitVideoAnalysis();
  const {
    setCurrentAnalysisId,
    setUploadProgress,
    setProcessingStatus,
    setCurrentFile,
    reset,
  } = useAnalysisStore();
  const { username } = useAuthContext();

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [termLogs, setTermLogs] = useState<TerminalLog[]>([]);
  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [termLogs]);

  // Drip-feed a list of logs one by one with random small delays
  const dripLogs = useCallback(
    (logs: TerminalLog[], baseDelayMs = 0) => {
      logs.forEach((log, i) => {
        const delay = baseDelayMs + i * (80 + Math.random() * 120);
        setTimeout(() => {
          setTermLogs((prev) => [...prev, log]);
        }, delay);
      });
    },
    [],
  );

  // Push startup logs once on first process start
  const startupFiredRef = useRef(false);
  const triggerStartupLogs = useCallback(() => {
    if (startupFiredRef.current) return;
    startupFiredRef.current = true;
    dripLogs(STARTUP_LOGS, 0);
  }, [dripLogs]);

  const videoMeta = useVideoMeta(file);

  const activeStepIndex = PROCESSING_STEPS.findIndex((s) => s.phase === phase);

  const clearProgressInterval = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  const validateFile = useCallback((f: File): string | null => {
    if (!ACCEPTED_TYPES.includes(f.type))
      return `Unsupported format. Accepted: ${ACCEPTED_DISPLAY}.`;
    if (f.size > MAX_SIZE_BYTES)
      return "File too large. Maximum allowed size is 500 MB.";
    return null;
  }, []);

  const handleFile = useCallback(
    (f: File) => {
      const err = validateFile(f);
      if (err) {
        toast.error("Invalid file", { description: err });
        setFile(null);
        return;
      }
      setFile(f);
      setCurrentFile(f);
      setPhase("file-selected");
      setErrorMsg(null);
    },
    [validateFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const advanceProgress = (
    from: number,
    to: number,
    durationMs: number,
    onDone?: () => void,
  ) => {
    clearProgressInterval();
    const steps = 30;
    const interval = durationMs / steps;
    const increment = (to - from) / steps;
    let current = from;
    progressIntervalRef.current = setInterval(() => {
      current += increment;
      if (current >= to) {
        current = to;
        clearProgressInterval();
        onDone?.();
      }
      setProgress(Math.round(current));
      setUploadProgress(Math.round(current));
    }, interval);
  };

  const runProcessingSimulation = (analysisId: string) => {
    const sequence: {
      phase: UploadPhase;
      from: number;
      to: number;
      dur: number;
    }[] = [
      { phase: "uploading",    from: 0,  to: 20,  dur: 900  },
      { phase: "initializing", from: 20, to: 38,  dur: 700  },
      { phase: "cnn",          from: 38, to: 65,  dur: 1200 },
      { phase: "rnn",          from: 65, to: 85,  dur: 1000 },
      { phase: "report",       from: 85, to: 100, dur: 700  },
    ];

    // Startup logs fire first, then phase logs drip in
    triggerStartupLogs();

    let seqIndex = 0;
    // Track cumulative time for log drip offsets
    let cumulativeMs = STARTUP_LOGS.length * 100 + 400;

    const runNext = () => {
      if (seqIndex >= sequence.length) {
        setPhase("complete");
        setCurrentAnalysisId(analysisId);
        setProcessingStatus("Complete");
        setTimeout(
          () => navigate({ to: "/results/$id", params: { id: analysisId } }),
          800,
        );
        return;
      }
      const step = sequence[seqIndex];
      setPhase(step.phase);
      setProcessingStatus(step.phase);

      // Drip phase-specific logs
      const phaseLogs = PHASE_LOGS[step.phase] ?? [];
      dripLogs(phaseLogs, cumulativeMs);
      cumulativeMs += phaseLogs.length * 120 + 200;

      advanceProgress(step.from, step.to, step.dur, () => {
        seqIndex++;
        runNext();
      });
    };

    runNext();
  };

  const handleSubmit = async () => {
    if (!file) return;
    reset();
    setProgress(0);
    setPhase("uploading");
    setErrorMsg(null);

    try {
      const analysisId = await submitMutation.mutateAsync({
        filename: file.name,
        fileSize: BigInt(file.size),
        frameRate: undefined,
        resolution: undefined,
        file: file,
      });
      toast.success("Video submitted for analysis", {
        description: `Analysis ID: ${analysisId.slice(0, 8)}…`,
      });
      runProcessingSimulation(analysisId);
    } catch {
      clearProgressInterval();
      setPhase("error");
      setErrorMsg(
        "Server error during video processing. Please try again.",
      );
      toast.error("Analysis submission failed", {
        description: "Server error - please retry.",
      });
    }
  };

  const handleCancel = () => {
    clearProgressInterval();
    reset();
    setFile(null);
    setPhase("idle");
    setProgress(0);
    setErrorMsg(null);
    setTermLogs([]);
    startupFiredRef.current = false;
  };

  const handleRetry = () => {
    setPhase("file-selected");
    setErrorMsg(null);
    setProgress(0);
  };

  const isProcessing =
    PHASE_ORDER.indexOf(phase) >= 0 &&
    phase !== "idle" &&
    phase !== "file-selected" &&
    phase !== "complete" &&
    phase !== "error";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background grid-forensic">
      <div className="container mx-auto px-4 py-4 md:py-8 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Header */}
          <div className="mb-6">
            <motion.span
              className="font-mono text-xs text-primary uppercase tracking-[0.2em] mb-2 flex items-center gap-2"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <span className="inline-block w-8 h-px bg-primary" />
              Forensic Submission
            </motion.span>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight">
              Upload Video
            </h1>
            <p className="text-muted-foreground mt-2 text-sm font-mono">
              Submit a video file for deepfake and manipulation analysis.
            </p>
          </div>

          {/* Processing view */}
          <AnimatePresence mode="wait">
            {isProcessing || phase === "error" ? (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3 }}
              >
                {/* Processing card with scan animation */}
                <Card
                  className={`relative overflow-hidden border mb-5 ${
                    phase === "error"
                      ? "border-fake/50"
                      : "border-primary/40 pulse-neon glow-primary"
                  }`}
                  data-ocid="processing-card"
                >
                  {/* Scan line */}
                  {isProcessing && (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      <div className="animate-scan absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />
                    </div>
                  )}

                  <div className="p-5 md:p-7">
                    {phase === "error" ? (
                      <div className="flex flex-col items-center gap-4 py-4 text-center">
                        <div className="w-14 h-14 rounded-full bg-fake-subtle border border-fake/40 flex items-center justify-center">
                          <AlertCircle size={26} className="text-fake" />
                        </div>
                        <div>
                          <p className="font-mono font-semibold text-fake text-sm">
                            ANALYSIS FAILED
                          </p>
                          <p className="text-muted-foreground text-sm mt-1">
                            {errorMsg}
                          </p>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                          <Button
                            variant="outline"
                            className="flex-1 gap-2 border-fake/40 text-fake hover:bg-fake-subtle"
                            onClick={handleRetry}
                            data-ocid="retry-btn"
                          >
                            <RefreshCw size={15} />
                            Retry
                          </Button>
                          <Button
                            variant="ghost"
                            className="flex-1 gap-2"
                            onClick={handleCancel}
                            data-ocid="cancel-btn"
                          >
                            <X size={15} />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Progress bar */}
                        <div className="mb-5">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="font-mono text-xs text-primary uppercase tracking-widest">
                              Analysis Progress
                            </span>
                            <span className="font-mono text-xs font-bold text-primary tabular-nums">
                              {progress}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-primary"
                              style={{
                                background:
                                  "linear-gradient(90deg, oklch(var(--primary) / 0.8), oklch(var(--primary)))",
                                boxShadow:
                                  "0 0 10px oklch(var(--primary) / 0.5)",
                              }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 0.3, ease: "linear" }}
                            />
                          </div>
                        </div>

                        {/* File info */}
                        {file && (
                          <div className="flex items-center gap-2 mb-4 p-2.5 rounded-lg bg-muted/30 border border-border">
                            <Film
                              size={14}
                              className="text-primary flex-shrink-0"
                            />
                            <span className="font-mono text-xs text-foreground truncate min-w-0">
                              {file.name}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground ml-auto flex-shrink-0">
                              {formatBytes(file.size)}
                            </span>
                          </div>
                        )}

                        {/* Steps */}
                        <div className="flex flex-col gap-2">
                          {PROCESSING_STEPS.map((step, i) => (
                            <StepRow
                              key={step.phase}
                              step={step}
                              index={i}
                              activeIndex={activeStepIndex}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </Card>

                {/* ── Backend Terminal ── */}
                {termLogs.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <Card className="border-border bg-[#0d1117] overflow-hidden">
                      {/* Terminal header bar */}
                      <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#30363d]">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-[#ff5f57] inline-block" />
                          <span className="w-3 h-3 rounded-full bg-[#ffbd2e] inline-block" />
                          <span className="w-3 h-3 rounded-full bg-[#27c93f] inline-block" />
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                          <Terminal size={10} />
                          veriframe-backend — python3 app/main.py
                        </div>
                        <div className="w-12" />
                      </div>
                      {/* Terminal body */}
                      <div
                        ref={termRef}
                        className="p-3 h-52 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5 scroll-smooth"
                        style={{ scrollbarWidth: "thin", scrollbarColor: "#30363d transparent" }}
                        data-ocid="backend-terminal"
                      >
                        {termLogs.map((log) => (
                          <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.18 }}
                            className={`flex gap-2 ${logColor(log.level)}`}
                          >
                            <span className="text-slate-600 shrink-0 select-none">
                              {log.ts}
                            </span>
                            <span className="shrink-0 select-none w-3 text-center">
                              {logPrefix(log.level)}
                            </span>
                            <span className="break-all">{log.msg}</span>
                          </motion.div>
                        ))}
                        {/* Blinking cursor */}
                        {isProcessing && (
                          <div className="flex gap-2 text-slate-400 mt-1">
                            <span className="text-slate-600 shrink-0">{nowTs()}</span>
                            <span className="shrink-0 w-3 text-center">·</span>
                            <span className="inline-block w-2 h-3.5 bg-slate-400 animate-pulse rounded-sm" />
                          </div>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                )}

                {isProcessing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-2 text-muted-foreground hover:text-foreground text-xs"
                    onClick={handleCancel}
                    data-ocid="cancel-processing-btn"
                  >
                    <X size={13} />
                    Cancel Analysis
                  </Button>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="upload"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3 }}
              >
                {/* Drop Zone */}
                <label
                  aria-label="Video upload drop zone — click or drag and drop a video file"
                  className={`relative group border-2 border-dashed rounded-xl cursor-pointer mb-4 block transition-all duration-300 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-background ${
                    dragOver
                      ? "border-primary bg-primary/8 shadow-[0_0_30px_oklch(var(--primary)/0.2)]"
                      : file
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-primary/3 bg-card"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  data-ocid="upload-dropzone"
                >
                  {/* Neon corner accents when dragging */}
                  {dragOver && (
                    <>
                      <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary rounded-tl-xl" />
                      <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary rounded-tr-xl" />
                      <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary rounded-bl-xl" />
                      <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary rounded-br-xl" />
                    </>
                  )}

                  <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    className="sr-only"
                    onChange={(e) =>
                      e.target.files?.[0] && handleFile(e.target.files[0])
                    }
                  />

                  <div className="p-8 md:p-14 flex flex-col items-center gap-5 text-center">
                    <AnimatePresence mode="wait">
                      {file ? (
                        <motion.div
                          key="file-preview"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex flex-col items-center gap-4 w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Video thumbnail */}
                          {videoMeta.objectUrl && (
                            <div className="relative rounded-lg overflow-hidden border border-primary/30 bg-muted w-full max-w-xs aspect-video">
                              <video
                                src={videoMeta.objectUrl}
                                className="w-full h-full object-cover"
                                muted
                                preload="metadata"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-background/20">
                                <div className="w-10 h-10 rounded-full bg-card/80 border border-primary/40 flex items-center justify-center backdrop-blur-sm">
                                  <Film size={18} className="text-primary" />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* File metadata */}
                          <div className="w-full max-w-xs space-y-1.5">
                            <p
                              className="font-semibold text-foreground truncate text-sm"
                              title={file.name}
                            >
                              {file.name}
                            </p>
                            <div className="flex justify-center gap-4 font-mono text-xs text-muted-foreground">
                              <span>{formatBytes(file.size)}</span>
                              {videoMeta.duration !== null && (
                                <span>
                                  {formatDuration(videoMeta.duration)}
                                </span>
                              )}
                              <span className="uppercase">
                                {file.type.split("/")[1]}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-real font-mono">
                            <CheckCircle2 size={12} />
                            File validated — ready to submit
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancel();
                            }}
                            data-ocid="remove-file-btn"
                          >
                            <X size={11} />
                            Remove file
                          </Button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="drop-prompt"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex flex-col items-center gap-4"
                        >
                          <motion.div
                            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-smooth ${
                              dragOver
                                ? "bg-primary/20 border border-primary/40 shadow-[0_0_20px_oklch(var(--primary)/0.3)]"
                                : "bg-muted/60 border border-border group-hover:border-primary/30 group-hover:bg-primary/8"
                            }`}
                            animate={dragOver ? { scale: 1.1 } : { scale: 1 }}
                          >
                            <UploadCloud
                              size={28}
                              className={`transition-smooth ${dragOver ? "text-primary" : "text-muted-foreground group-hover:text-primary/70"}`}
                            />
                          </motion.div>
                          <div>
                            <p className="font-semibold text-foreground text-base md:text-lg">
                              {dragOver
                                ? "Drop to upload"
                                : "Drop your video here"}
                            </p>
                            <p className="text-muted-foreground text-sm mt-1">
                              or{" "}
                              <span className="text-primary underline underline-offset-2 cursor-pointer">
                                browse files
                              </span>
                            </p>
                          </div>
                          <div className="flex flex-wrap justify-center gap-2">
                            {["MP4", "MOV", "AVI", "WebM"].map((fmt) => (
                              <span
                                key={fmt}
                                className="font-mono text-xs text-muted-foreground bg-muted/50 border border-border rounded px-2 py-0.5"
                              >
                                {fmt}
                              </span>
                            ))}
                            <span className="font-mono text-xs text-muted-foreground bg-muted/50 border border-border rounded px-2 py-0.5">
                              Max 500 MB
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </label>

                {/* Info cards */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: "Architecture", value: "CNN+RNN" },
                    { label: "Detection Signals", value: "6 layers" },
                    { label: "Avg. Time", value: "~30s" },
                  ].map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.06 }}
                    >
                      <Card className="p-3 bg-muted/20 border-border text-center">
                        <div className="font-mono text-sm font-bold text-primary">
                          {item.value}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground mt-0.5">
                          {item.label}
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Submit button */}
                <Button
                  size="lg"
                  className="w-full gap-2.5 font-mono font-semibold tracking-wider"
                  disabled={!file || submitMutation.isPending}
                  onClick={handleSubmit}
                  data-ocid="submit-analysis-btn"
                >
                  <UploadCloud size={18} />
                  Begin Forensic Analysis
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

export function UploadPageComponent() {
  return (
    <ProtectedRoute>
      <UploadPageContent />
    </ProtectedRoute>
  );
}
