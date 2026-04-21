import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useParams } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, Eye, Lock, Share2 } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { ScoreRadial } from "../components/ScoreRadial";
import { VerdictBadge, VerdictHeroBanner } from "../components/VerdictBadge";
import { VideoPlayerWithOverlay } from "../components/VideoPlayerWithOverlay";
import { useGetSharedAnalysis } from "../hooks/useAnalysis";
import type { AnalysisRecord, FlaggedFrame } from "../lib/types";
import { AnalysisStatus } from "../lib/types";

export const Route = undefined;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const forensicLabels: Record<string, string> = {
  deepfakeProbability: "Deepfake Probability",
  frameInsertionRisk: "Frame Insertion Risk",
  frameDeletionRisk: "Frame Deletion Risk",
  temporalInconsistencyScore: "Temporal Inconsistency",
  compressionArtifactScore: "Compression Artifacts",
  audioVideoSyncScore: "Audio/Video Sync",
};

function formatTs(ts: bigint): string {
  return new Date(Number(ts) / 1_000_000).toLocaleString();
}

function formatBytes(bytes: bigint): string {
  const n = Number(bytes);
  if (n >= 1024 * 1024 * 1024)
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function pctColor(pct: number) {
  if (pct <= 30) return "bg-real";
  if (pct <= 65) return "bg-uncertain";
  return "bg-fake";
}

function pctTextColor(pct: number) {
  if (pct <= 30) return "text-real";
  if (pct <= 65) return "text-uncertain";
  return "text-fake";
}

// ─── Animated Score Bar ──────────────────────────────────────────────────────

function ScoreBar({
  label,
  value,
  delay = 0,
}: { label: string; value: number; delay?: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground font-mono">{label}</span>
        <span className={`text-xs font-mono font-bold ${pctTextColor(pct)}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${pctColor(pct)}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

// ─── Frame Thumbnails ─────────────────────────────────────────────────────────

const FRAME_PALETTE = [
  "oklch(0.25 0.06 0)",
  "oklch(0.22 0.08 30)",
  "oklch(0.28 0.07 350)",
  "oklch(0.23 0.05 15)",
  "oklch(0.2 0.09 340)",
  "oklch(0.26 0.06 10)",
];

function frameVerdict(suspicionScore: number): {
  label: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
} {
  if (suspicionScore >= 0.65)
    return {
      label: "FAKE",
      textClass: "text-fake",
      bgClass: "bg-fake",
      borderClass: "border-fake",
    };
  if (suspicionScore <= 0.35)
    return {
      label: "REAL",
      textClass: "text-real",
      bgClass: "bg-real",
      borderClass: "border-real",
    };
  return {
    label: "UNCERTAIN",
    textClass: "text-uncertain",
    bgClass: "bg-uncertain",
    borderClass: "border-uncertain",
  };
}

function FrameThumbnail({
  frame,
  index,
}: { frame: FlaggedFrame; index: number }) {
  const pct = Math.round(frame.suspicionScore * 100);
  const bg = FRAME_PALETTE[index % FRAME_PALETTE.length];
  const fv = frameVerdict(frame.suspicionScore);

  // Use Cloudinary URL from backend
  const displaySrc = frame.extractedFrame;

  return (
    <motion.div
      className={`relative rounded-lg overflow-hidden border bg-card group cursor-default ${fv.borderClass}`}
      style={{ aspectRatio: "16/9" }}
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: (index % 8) * 0.06 }}
      data-ocid="frame-thumbnail"
    >
      {/* Frame from Cloudinary or placeholder */}
      {displaySrc ? (
        <img
          src={displaySrc}
          alt={`Frame ${frame.frameIndex}`}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: bg }} />
      )}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.06)_2px,rgba(0,0,0,0.06)_4px)]" />
      {/* Suspicion bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
        <div
          className={`h-full transition-all duration-700 ${fv.bgClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Frame index label */}
      <div className="absolute top-1.5 left-1.5 bg-black/70 rounded px-1.5 py-0.5">
        <span className="font-mono text-[10px] text-muted-foreground">#</span>
        <span className="font-mono text-[10px] font-bold text-foreground">
          {String(frame.frameIndex)}
        </span>
      </div>
      {/* Per-frame verdict badge */}
      <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center gap-0.5 pointer-events-none">
        <span
          className={`font-mono text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded bg-black/75 ${fv.textClass}`}
        >
          {fv.label}
        </span>
        <span
          className={`font-mono text-[9px] font-bold ${fv.textClass} opacity-90`}
        >
          {pct}%
        </span>
      </div>
      {/* Hover overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/50">
        <div className="flex flex-col items-center gap-1">
          <span
            className={`font-mono font-black text-base tracking-widest ${fv.textClass}`}
          >
            {fv.label}
          </span>
          <span className={`font-mono font-bold text-sm ${fv.textClass}`}>
            {pct}% suspicion
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Temporal Chart ───────────────────────────────────────────────────────────

interface ChartPoint {
  frame: number;
  suspicion: number;
}

function TemporalChart({ frames }: { frames: FlaggedFrame[] }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShow(true);
      },
      { threshold: 0.2 },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const data: ChartPoint[] = frames.map((f) => ({
    frame: Number(f.frameIndex),
    suspicion: Math.round(f.suspicionScore * 100),
  }));

  return (
    <div ref={ref} className="w-full h-52">
      {show && (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, bottom: 0, left: -8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(0.25 0.018 260)"
              vertical={false}
            />
            <XAxis
              dataKey="frame"
              tick={{
                fill: "oklch(0.55 0.01 260)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
              tickLine={false}
              axisLine={false}
              label={{
                value: "Frame Index",
                position: "insideBottom",
                offset: 2,
                fill: "oklch(0.45 0.01 260)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{
                fill: "oklch(0.55 0.01 260)",
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.14 0.018 260)",
                border: "1px solid oklch(0.25 0.018 260)",
                borderRadius: 6,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "oklch(0.95 0.01 260)",
              }}
              formatter={(val: number) => [`${val}%`, "Suspicion"]}
              labelFormatter={(l: number) => `Frame #${l}`}
            />
            <Line
              type="monotone"
              dataKey="suspicion"
              stroke="oklch(0.78 0.18 210)"
              strokeWidth={2}
              dot={{ r: 3, fill: "oklch(0.78 0.18 210)", strokeWidth: 0 }}
              activeDot={{
                r: 5,
                fill: "oklch(0.78 0.18 210)",
                stroke: "oklch(0.14 0.018 260)",
                strokeWidth: 2,
              }}
              isAnimationActive={true}
              animationDuration={1400}
              animationEasing="ease-out"
              style={{
                filter: "drop-shadow(0 0 4px oklch(0.78 0.18 210 / 0.7))",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Forensic Metadata Table ──────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2.5 pr-4 text-xs font-mono text-muted-foreground whitespace-nowrap w-44">
        {label}
      </td>
      <td className="py-2.5 text-xs font-mono text-foreground break-all">
        {value}
      </td>
    </tr>
  );
}

function ForensicTable({ record }: { record: AnalysisRecord }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" data-ocid="forensic-table">
        <tbody>
          <MetaRow label="Filename" value={record.filename} />
          <MetaRow label="File Size" value={formatBytes(record.fileSize)} />
          <MetaRow
            label="Resolution"
            value={record.frameAnalysis.resolution || "—"}
          />
          <MetaRow
            label="Frame Rate"
            value={`${record.frameAnalysis.frameRate} fps`}
          />
          <MetaRow
            label="Frame Count"
            value={Number(record.frameAnalysis.frameCount).toLocaleString()}
          />
          <MetaRow
            label="Flagged Frames"
            value={`${record.frameAnalysis.flaggedFrames.length} / ${Number(record.frameAnalysis.frameCount).toLocaleString()}`}
          />
          <MetaRow
            label="Color Anomaly Score"
            value={`${Math.round(record.frameAnalysis.colorAnomalyScore * 100)}%`}
          />
          <MetaRow
            label="Upload Time"
            value={formatTs(record.uploadTimestamp)}
          />
          <MetaRow
            label="Overall Risk Score"
            value={`${record.overallScore}/100`}
          />
          <MetaRow label="Verdict" value={record.verdict} />
        </tbody>
      </table>
    </div>
  );
}

// ─── Shared Page Component ─────────────────────────────────────────────────────

export function SharedPageComponent() {
  const { token } = useParams({ strict: false }) as { token: string };
  const { data: record, isLoading, error } = useGetSharedAnalysis(token);

  const handleCopyLink = async () => {
    // Use configurable base URL or fallback to current origin
    const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
    const url = `${baseUrl}/shared/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  if (isLoading) {
    return (
      <div
        className="container mx-auto px-4 py-12 max-w-4xl space-y-5"
        data-ocid="loading-skeleton"
      >
        <div className="flex items-center gap-2 px-4 py-2.5 rounded border border-border bg-card">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-3 w-52" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-3 w-44" />
        </div>
        <Skeleton className="h-44 w-full rounded-xl" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-36" />
          {(["a", "b", "c", "d", "e", "f"] as const).map((k) => (
            <div key={k} className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="text-center pt-2">
          <p className="text-xs font-mono text-muted-foreground animate-pulse tracking-widest uppercase">
            Loading forensic analysis…
          </p>
        </div>
      </div>
    );
  }

  if (error || !record || record.status !== AnalysisStatus.Complete) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          data-ocid="error-card"
        >
          <Card className="p-10 text-center bg-card border-border relative overflow-hidden">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_28px,oklch(0.68_0.24_25/0.03)_28px,oklch(0.68_0.24_25/0.03)_29px)] pointer-events-none" />
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-fake-subtle border border-fake/30 flex items-center justify-center mx-auto mb-5">
                <AlertCircle size={28} className="text-fake" />
              </div>
              <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">
                Link Unavailable
              </div>
              <h1 className="font-display font-bold text-xl text-foreground mb-2">
                Analysis Not Found
              </h1>
              <p className="text-muted-foreground text-sm mb-6 font-mono leading-relaxed">
                This share link may have expired, the analysis is not yet
                complete, or the record has been removed.
              </p>
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link to="/">
                  <ArrowRight size={13} />
                  Go to VeriFrame
                </Link>
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  const flaggedCount = record.frameAnalysis.flaggedFrames.length;
  const frameTotal = Number(record.frameAnalysis.frameCount);
  const forensicEntries = Object.entries(record.forensic);

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      {/* Shared read-only banner */}
      <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary rounded px-4 py-2.5 mb-6 font-mono text-sm">
        <Eye size={14} />
        <span className="font-semibold">Shared Forensic Report</span>
        <span className="text-primary/60">—</span>
        <Badge
          variant="outline"
          className="border-primary/40 text-primary font-mono text-[10px] gap-1 py-0"
        >
          <Lock size={9} />
          Read-Only View
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyLink}
          className="ml-auto h-7 gap-1.5 text-xs text-primary hover:text-primary"
          data-ocid="copy-link-btn"
        >
          <Share2 size={12} />
          Copy Link
        </Button>
      </div>

      <motion.div
        className="space-y-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* File Header */}
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground truncate max-w-2xl">
            {record.filename}
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Analyzed: {formatTs(record.uploadTimestamp)}
          </p>
        </div>

        {/* ── Video Player + Face Detection Overlay ── */}
        <Card
          className="p-6 bg-card border-border relative overflow-hidden"
          data-ocid="video-player-card"
        >
          <div className="absolute inset-0 grid-forensic opacity-20 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
              <h2 className="font-mono font-semibold text-foreground text-sm uppercase tracking-wider">
                Play to see Result
              </h2>
            </div>
            <p className="text-xs font-mono text-muted-foreground mb-4">
              Forensic face detection simulation — CNN + Attention model overlay
            </p>
            <VideoPlayerWithOverlay
              verdict={record.verdict}
              confidence={
                record.verdict === "Real"
                  ? (1 - record.forensic.deepfakeProbability) * 100
                  : record.forensic.deepfakeProbability * 100
              }
              videoUrl={record.videoUrl ?? null}
            />
          </div>
        </Card>

        {/* ── Verdict Hero Banner ── */}
        <VerdictHeroBanner
          verdict={record.verdict}
          overallScore={record.overallScore}
        />

        {/* ── Hero Results Card ── */}
        <Card
          className="p-6 bg-card border-border relative overflow-hidden"
          data-ocid="hero-results-card"
        >
          <div className="absolute inset-0 grid-forensic opacity-30 pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-center gap-8">
            <div className="flex flex-col items-center gap-3 shrink-0">
              <ScoreRadial
                score={record.overallScore}
                size={148}
                strokeWidth={11}
              />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                Authenticity Risk
              </span>
            </div>
            <div className="flex-1 space-y-5 min-w-0">
              <VerdictBadge verdict={record.verdict} size="lg" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "File Size", value: formatBytes(record.fileSize) },
                  {
                    label: "Resolution",
                    value: record.frameAnalysis.resolution || "—",
                  },
                  {
                    label: "Frame Rate",
                    value: `${record.frameAnalysis.frameRate} fps`,
                  },
                  { label: "Frames", value: frameTotal.toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
                      {label}
                    </div>
                    <div className="font-mono text-sm font-semibold text-foreground">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* ── Manipulation Indicators ── */}
        <Card className="p-6 bg-card border-border">
          <h2 className="font-mono font-semibold text-foreground mb-5 flex items-center gap-2 text-sm uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
            Manipulation Indicators
          </h2>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4"
            data-ocid="indicators-grid"
          >
            {forensicEntries.map(([key, value], i) => (
              <ScoreBar
                key={key}
                label={forensicLabels[key] ?? key}
                value={value as number}
                delay={i * 0.08}
              />
            ))}
          </div>
        </Card>

        {/* ── Frame Analysis Section ── */}
        {flaggedCount > 0 && (
          <Card className="p-6 bg-card border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="font-mono font-semibold text-foreground flex items-center gap-2 text-sm uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-fake inline-block" />
                  Frame Analysis
                </h2>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                  Suspicious frames with anomaly overlays
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="destructive" className="font-mono text-xs">
                  {flaggedCount} flagged
                </Badge>
                <span className="text-xs font-mono text-muted-foreground">
                  Color Anomaly:{" "}
                  <span
                    className={pctTextColor(
                      Math.round(record.frameAnalysis.colorAnomalyScore * 100),
                    )}
                  >
                    {Math.round(record.frameAnalysis.colorAnomalyScore * 100)}%
                  </span>
                </span>
              </div>
            </div>
            {/* Resolution / framerate info bar */}
            <div className="flex items-center gap-4 mb-4 px-3 py-2 bg-muted/40 rounded font-mono text-xs text-muted-foreground">
              <span>
                RES:{" "}
                <span className="text-foreground">
                  {record.frameAnalysis.resolution || "—"}
                </span>
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span>
                FPS:{" "}
                <span className="text-foreground">
                  {record.frameAnalysis.frameRate}
                </span>
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span>
                TOTAL:{" "}
                <span className="text-foreground">
                  {frameTotal.toLocaleString()}
                </span>
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span>
                FLAGGED: <span className="text-fake">{flaggedCount}</span>
              </span>
            </div>
            {/* Color anomaly bar */}
            <div className="mb-5">
              <ScoreBar
                label="Color Anomaly Score"
                value={record.frameAnalysis.colorAnomalyScore}
                delay={0}
              />
            </div>
            <Separator className="mb-5" />
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1"
              data-ocid="frame-grid"
            >
              {record.frameAnalysis.flaggedFrames.slice(0, 32).map((f, i) => (
                <FrameThumbnail
                  key={String(f.frameIndex)}
                  frame={f}
                  index={i}
                />
              ))}
            </div>
            {flaggedCount > 32 && (
              <p className="text-xs text-muted-foreground font-mono mt-3 text-center">
                +{flaggedCount - 32} more flagged frames
              </p>
            )}
          </Card>
        )}

        {/* ── Temporal Consistency Graph ── */}
        {flaggedCount > 1 && (
          <Card className="p-6 bg-card border-border">
            <h2 className="font-mono font-semibold text-foreground mb-1 flex items-center gap-2 text-sm uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
              Temporal Consistency
            </h2>
            <p className="text-xs font-mono text-muted-foreground mb-5">
              Suspicion score per flagged frame — neon spike = high manipulation
              probability
            </p>
            <div
              className="bg-muted/20 rounded-lg p-3 border border-border"
              data-ocid="temporal-chart"
            >
              <TemporalChart frames={record.frameAnalysis.flaggedFrames} />
            </div>
          </Card>
        )}

        {/* ── Forensic Metadata Table ── */}
        <Card className="p-6 bg-card border-border">
          <h2 className="font-mono font-semibold text-foreground mb-5 flex items-center gap-2 text-sm uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />
            Forensic Metadata
          </h2>
          <ForensicTable record={record} />
        </Card>

        {/* CTA footer */}
        <div className="text-center py-4 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3 font-mono">
            Analyze your own videos with VeriFrame
          </p>
          <Button asChild size="sm" className="gap-1.5" data-ocid="shared-cta">
            <Link to="/">
              Try VeriFrame
              <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
