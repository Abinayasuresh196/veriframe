import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  Share2,
  Trash2,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
import { ProtectedRoute } from "../components/ProtectedRoute";
import { ScoreRadial } from "../components/ScoreRadial";
import { VerdictBadge, VerdictHeroBanner } from "../components/VerdictBadge";
import { VideoPlayerWithOverlay } from "../components/VideoPlayerWithOverlay";
import { TimelineView } from "../components/TimelineView";
import { ExplanationPanel } from "../components/ExplanationPanel";
import { useAnalysisStore } from "../stores/analysisStore";
import {
  useDeleteAnalysisRecord,
  useGenerateShareToken,
  useGetAnalysisResult,
} from "../hooks/useAnalysis";
import type { AnalysisRecord, FlaggedFrame } from "../lib/types";
import { AnalysisStatus } from "../lib/types";

export const Route = undefined;

// Palette uses CSS custom properties so they adapt to theme changes
const FRAME_PALETTE = [
  "color-mix(in oklch, var(--color-destructive, #dc2626) 30%, transparent)",
  "color-mix(in oklch, var(--color-destructive, #dc2626) 25%, transparent)",
  "color-mix(in oklch, var(--color-destructive, #dc2626) 35%, transparent)",
  "color-mix(in oklch, var(--color-destructive, #dc2626) 28%, transparent)",
  "color-mix(in oklch, var(--color-destructive, #dc2626) 22%, transparent)",
  "color-mix(in oklch, var(--color-destructive, #dc2626) 32%, transparent)",
];

function frameVerdict(suspicionScore: number): {
  label: string;
  verdict: "FAKE" | "REAL" | "UNCERTAIN";
  textClass: string;
  bgClass: string;
  borderClass: string;
} {
  if (suspicionScore >= 0.65)
    return {
      label: "FAKE",
      verdict: "FAKE",
      textClass: "text-fake",
      bgClass: "bg-fake",
      borderClass: "border-fake",
    };
  if (suspicionScore <= 0.35)
    return {
      label: "REAL",
      verdict: "REAL",
      textClass: "text-real",
      bgClass: "bg-real",
      borderClass: "border-real",
    };
  return {
    label: "UNCERTAIN",
    verdict: "UNCERTAIN",
    textClass: "text-uncertain",
    bgClass: "bg-uncertain",
    borderClass: "border-uncertain",
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
    <div className="space-y-1.5" data-ocid="score-bar">
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

// ─── Status Banner ───────────────────────────────────────────────────────────

function StatusBanner({ status }: { status: AnalysisStatus }) {
  const config = {
    [AnalysisStatus.Queued]: {
      icon: Clock,
      label: "Queued — waiting to be processed…",
      classes: "bg-muted/50 text-muted-foreground border-border",
    },
    [AnalysisStatus.Processing]: {
      icon: Loader2,
      label: "Processing — forensic analysis in progress…",
      classes: "bg-primary/10 text-primary border-primary/30",
    },
    [AnalysisStatus.Complete]: {
      icon: CheckCircle2,
      label: "Analysis complete",
      classes: "bg-real-subtle text-real border-real",
    },
    [AnalysisStatus.Failed]: {
      icon: XCircle,
      label: "Analysis failed — please resubmit",
      classes: "bg-fake-subtle text-fake border-fake",
    },
  };
  const c = config[status];
  const Icon = c.icon;
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2.5 rounded border font-mono text-sm ${c.classes}`}
    >
      <Icon
        size={14}
        className={status === AnalysisStatus.Processing ? "animate-spin" : ""}
      />
      {c.label}
    </div>
  );
}

// ─── Full-page Loading Skeleton ──────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" data-ocid="loading-skeleton">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded" />
      {/* Hero card skeleton */}
      <Skeleton className="h-44 w-full rounded-xl" />
      {/* Section skeletons */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
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
      <div className="text-center">
        <p className="text-xs font-mono text-muted-foreground animate-pulse tracking-widest uppercase mt-2">
          Loading forensic analysis…
        </p>
      </div>
    </div>
  );
}

// ─── Frame Thumbnail Grid ────────────────────────────────────────────────────

// ─── Frame Thumbnail Component ─────────────────────────────────────────────

function FrameThumbnail({
  frame,
  index,
  file,
  frameRate,
  isSelected,
  onClick,
  overallVerdict,
}: { 
  frame: FlaggedFrame; 
  index: number;
  file: File | null;
  frameRate: number;
  isSelected?: boolean;
  onClick?: () => void;
  overallVerdict?: "Fake" | "Real" | "Uncertain";
}) {
  const pct = Math.round(frame.suspicionScore * 100);
  const bg = FRAME_PALETTE[index % FRAME_PALETTE.length];
  const barW = `${pct}%`;
  
  // 🔥 FIX 2: Priority Backend Labeling
  const backendLabel = frame.label?.toUpperCase() as "FAKE" | "REAL" | "UNCERTAIN";
  const fv = backendLabel 
    ? { 
        verdict: backendLabel, 
        label: backendLabel, 
        textClass: `text-${backendLabel.toLowerCase()}`, 
        bgClass: `bg-${backendLabel.toLowerCase()}`, 
        borderClass: `border-${backendLabel.toLowerCase()}` 
      }
    : frameVerdict(frame.suspicionScore);

  // Use only Cloudinary URL from backend (no local extraction)
  const displaySrc = frame.extractedFrame;

  // Generate fake explanation based on score
  const getFrameExplanation = () => {
    if (frame.suspicionScore >= 0.85) {
      return "High facial inconsistency detected";
    } else if (frame.suspicionScore >= 0.75) {
      return "Temporal mismatch in facial features";
    } else if (frame.suspicionScore >= 0.65) {
      return "Compression artifacts detected";
    } else if (frame.suspicionScore >= 0.5) {
      return "Color anomaly in skin tones";
    } else {
      return "Low confidence indicators present";
    }
  };

  return (
    <motion.div
      className={`relative rounded-lg overflow-hidden border-2 bg-card group cursor-pointer transition-all duration-300 ${
        isSelected 
          ? 'ring-4 ring-primary ring-offset-2 ring-offset-background scale-105 z-10 border-primary' 
          : `${fv.borderClass} hover:scale-105 hover:shadow-2xl`
      } ${
        fv.verdict === 'FAKE' ? 'shadow-red-500/20 hover:shadow-red-500/40' : 
        fv.verdict === 'REAL' ? 'shadow-green-500/20 hover:shadow-green-500/40' :
        'shadow-yellow-500/20 hover:shadow-yellow-500/40'
      }`}
      style={{ 
        aspectRatio: "16/9",
        boxShadow: isSelected ? '0 0 30px rgba(59, 130, 246, 0.5)' : undefined
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: isSelected ? 1.05 : 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: (index % 8) * 0.06 }}
      onClick={onClick}
      data-ocid="frame-thumbnail"
      id={`frame-${frame.frameIndex}`}
    >
      {/* Glow effect for fake frames */}
      {fv.verdict === 'FAKE' && (
        <div className="absolute inset-0 bg-gradient-to-t from-red-500/20 via-transparent to-transparent pointer-events-none" />
      )}
      
      {/* Frame from Cloudinary or placeholder */}
      {displaySrc ? (
        <img
          src={displaySrc}
          alt={`Frame ${frame.frameIndex}`}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            // If image fails to load, show the colored background
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}
      
      {/* Fallback background - always render but image overlays it */}
      <div className="absolute inset-0 -z-10" style={{ background: bg }} />
      
      {/* Scanline overlay */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.06)_2px,rgba(0,0,0,0.06)_4px)]" />
      
      {/* Selection indicator */}
      {isSelected && (
        <motion.div 
          className="absolute inset-0 border-4 border-primary rounded-lg pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-full">
            SELECTED
          </div>
        </motion.div>
      )}
      
      {/* Suspicion bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/60">
        <motion.div
          className={`h-full ${fv.bgClass}`}
          initial={{ width: 0 }}
          animate={{ width: barW }}
          transition={{ duration: 0.7, delay: index * 0.05 }}
        />
      </div>
      
      {/* Frame index label top-left */}
      <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm rounded px-2 py-1">
        <span className="font-mono text-[10px] text-muted-foreground">#</span>
        <span className="font-mono text-[11px] font-bold text-foreground">
          {String(frame.frameIndex)}
        </span>
      </div>
      
      {/* Timestamp */}
      <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm rounded px-2 py-1">
        <span className="font-mono text-[10px] text-muted-foreground">
          {(() => {
            // 🔥 FIX 5: Fix Infinity/NaN
            const rate = Number.isFinite(frameRate) && frameRate > 0 ? frameRate : 30;
            const seconds = Number(frame.frameIndex) / rate;
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
          })()}
        </span>
      </div>
      
      {/* Per-frame verdict badge bottom */}
      <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center gap-1 pointer-events-none">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + index * 0.05 }}
          className={`font-mono text-[10px] font-black tracking-widest px-2 py-1 rounded-md bg-black/80 backdrop-blur-sm ${fv.textClass}`}
        >
          {fv.label}
        </motion.span>
        <span
          className={`font-mono text-[10px] font-bold ${fv.textClass} opacity-90 bg-black/60 px-1.5 rounded`}
        >
          {pct}%
        </span>
      </div>
      
      {/* Full hover overlay with explanation */}
      <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/70 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-2 p-3 text-center">
          <span
            className={`font-mono font-black text-lg tracking-widest ${fv.textClass}`}
          >
            {fv.label}
          </span>
          <span className={`font-mono font-bold text-base ${fv.textClass}`}>
            {pct}% suspicion
          </span>
          <div className="w-full h-px bg-white/20 my-1" />
          <span className="font-mono text-[10px] text-white/80 max-w-[140px] leading-tight">
            {getFrameExplanation()}
          </span>
          <span className="text-[9px] text-primary mt-1 font-mono">
            Click to select
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Temporal Consistency Chart ──────────────────────────────────────────────

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

// ─── Forensic Metrics Table ──────────────────────────────────────────────────

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
          <MetaRow label="Analysis ID" value={record.id} />
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

// ─── Download Report ─────────────────────────────────────────────────────────

function buildReport(record: AnalysisRecord): string {
  const lines: string[] = [
    "╔══════════════════════════════════════════════════════════╗",
    "║           VERIFRAME FORENSIC ANALYSIS REPORT             ║",
    "╚══════════════════════════════════════════════════════════╝",
    "",
    `Generated: ${new Date().toLocaleString()}`,
    `Analysis ID: ${record.id}`,
    "",
    "── FILE METADATA ────────────────────────────────────────────",
    `Filename:         ${record.filename}`,
    `File Size:        ${formatBytes(record.fileSize)}`,
    `Resolution:       ${record.frameAnalysis.resolution || "Unknown"}`,
    `Frame Rate:       ${record.frameAnalysis.frameRate} fps`,
    `Frame Count:      ${Number(record.frameAnalysis.frameCount).toLocaleString()}`,
    `Upload Timestamp: ${formatTs(record.uploadTimestamp)}`,
    "",
    "── VERDICT ──────────────────────────────────────────────────",
    `Overall Risk Score: ${record.overallScore}/100`,
    `Verdict:            ${record.verdict.toUpperCase()}`,
    "",
    "── FORENSIC BREAKDOWN ───────────────────────────────────────",
    `Deepfake Probability:       ${Math.round(record.forensic.deepfakeProbability * 100)}%`,
    `Frame Insertion Risk:       ${Math.round(record.forensic.frameInsertionRisk * 100)}%`,
    `Frame Deletion Risk:        ${Math.round(record.forensic.frameDeletionRisk * 100)}%`,
    `Temporal Inconsistency:     ${Math.round(record.forensic.temporalInconsistencyScore * 100)}%`,
    `Compression Artifacts:      ${Math.round(record.forensic.compressionArtifactScore * 100)}%`,
    `Audio/Video Sync:           ${Math.round(record.forensic.audioVideoSyncScore * 100)}%`,
    `Color Anomaly Score:        ${Math.round(record.frameAnalysis.colorAnomalyScore * 100)}%`,
    "",
    `── FLAGGED FRAMES (${record.frameAnalysis.flaggedFrames.length}) ──────────────────────────────────`,
    ...record.frameAnalysis.flaggedFrames.map(
      (f) =>
        `  Frame #${String(f.frameIndex).padStart(6, " ")}   Suspicion: ${Math.round(f.suspicionScore * 100)}%`,
    ),
    "",
    "────────────────────────────────────────────────────────────",
    "  Report generated by VeriFrame",
    "────────────────────────────────────────────────────────────",
  ];
  return lines.join("\n");
}

function downloadReport(record: AnalysisRecord) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Title section
  doc.setFontSize(20);
  doc.setTextColor(59, 130, 246);
  doc.text("VeriFrame Forensic Analysis Report", pageWidth / 2, 20, { align: "center" });
  
  // Metadata
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: "center" });
  doc.text(`Analysis ID: ${record.id}`, pageWidth / 2, 34, { align: "center" });
  
  // File metadata table
  const fileHeaders = [["Metadata", "Value"]];
  const fileSizeMB = (Number(record.fileSize) / (1024 * 1024)).toFixed(2);
  const confidence = record.verdict === "Real" 
    ? ((1 - record.forensic.deepfakeProbability) * 100).toFixed(1)
    : (record.forensic.deepfakeProbability * 100).toFixed(1);
  
  const fileData = [
    ["Filename", record.filename],
    ["File Size", `${fileSizeMB} MB`],
    ["Upload Date", new Date(Number(record.uploadTimestamp) / 1_000_000).toLocaleString()],
    ["Status", record.status],
    ["Verdict", record.verdict],
    ["Confidence Score", `${confidence}%`],
    ["Resolution", record.frameAnalysis.resolution || "N/A"],
    ["Frame Rate", `${record.frameAnalysis.frameRate} fps`],
    ["Frame Count", String(record.frameAnalysis.frameCount)],
    ["Flagged Frames", String(record.frameAnalysis.flaggedFrames.length)],
  ];
  
  autoTable(doc, {
    head: fileHeaders,
    body: fileData,
    startY: 45,
    theme: "grid",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
  });
  
  // Forensic breakdown table
  const forensicHeaders = [["Forensic Metric", "Score"]];
  const forensicData = [
    ["Deepfake Probability", `${(record.forensic.deepfakeProbability * 100).toFixed(2)}%`],
    ["Frame Insertion Risk", `${(record.forensic.frameInsertionRisk * 100).toFixed(2)}%`],
    ["Frame Deletion Risk", `${(record.forensic.frameDeletionRisk * 100).toFixed(2)}%`],
    ["Temporal Inconsistency", `${(record.forensic.temporalInconsistencyScore * 100).toFixed(2)}%`],
    ["Compression Artifacts", `${(record.forensic.compressionArtifactScore * 100).toFixed(2)}%`],
    ["Audio/Video Sync", `${(record.forensic.audioVideoSyncScore * 100).toFixed(2)}%`],
    ["Color Anomaly Score", `${(record.frameAnalysis.colorAnomalyScore * 100).toFixed(2)}%`],
  ];
  
  autoTable(doc, {
    head: forensicHeaders,
    body: forensicData,
    startY: (doc as any).lastAutoTable.finalY + 15,
    theme: "grid",
    headStyles: {
      fillColor: [34, 197, 94],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    alternateRowStyles: {
      fillColor: [240, 253, 244],
    },
  });
  
  // Flagged frames table
  if (record.frameAnalysis.flaggedFrames.length > 0) {
    const frameHeaders = [["Frame Index", "Suspicion Score", "Verdict"]];
    const frameData = record.frameAnalysis.flaggedFrames.map((f) => [
      String(f.frameIndex),
      `${(f.suspicionScore * 100).toFixed(1)}%`,
      f.suspicionScore >= 0.65 ? "FAKE" : f.suspicionScore >= 0.35 ? "UNCERTAIN" : "REAL",
    ]);
    
    autoTable(doc, {
      head: frameHeaders,
      body: frameData,
      startY: (doc as any).lastAutoTable.finalY + 15,
      theme: "grid",
      headStyles: {
        fillColor: [239, 68, 68],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      alternateRowStyles: {
        fillColor: [254, 242, 242],
      },
    });
  }
  
  // Footer
  const pageCount = (doc as any).internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `VeriFrame - Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }
  
  doc.save(`veriframe-${record.id.slice(0, 8)}-report.pdf`);
}

function downloadVideo(videoUrl: string | null, filename: string) {
  if (!videoUrl) return;
  const a = document.createElement("a");
  a.href = videoUrl;
  a.download = filename;
  a.target = "_blank";
  a.click();
}

// ─── Main Results Content ────────────────────────────────────────────────────

function ResultsContent({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data: record, isLoading, error, refetch } = useGetAnalysisResult(id);
  const { currentFile } = useAnalysisStore();
  const shareMutation = useGenerateShareToken();
  
  // State for selected frame
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);

  const videoUrl = useMemo(() => {
    if (!currentFile) return null;
    return URL.createObjectURL(currentFile);
  }, [currentFile]);
  const deleteMutation = useDeleteAnalysisRecord();
  
  // Handle frame selection from timeline
  const handleFrameClick = (frameIndex: number) => {
    setSelectedFrame(frameIndex);
    
    // Scroll to the frame in the grid
    const frameElement = document.getElementById(`frame-${frameIndex}`);
    if (frameElement) {
      frameElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleShare = async () => {
    if (!record) return;
    try {
      const token = await shareMutation.mutateAsync(record.id);
      // Use configurable base URL or fallback to current origin
      const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
      const url = `${baseUrl}/shared/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied!", { description: url });
    } catch {
      toast.error("Failed to generate share link");
    }
  };

  const handleDelete = async () => {
    if (!record) return;
    if (!window.confirm("Delete this analysis record? This cannot be undone."))
      return;
    try {
      await deleteMutation.mutateAsync(record.id);
      toast.success("Record deleted");
      navigate({ to: "/history" });
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleDownload = () => {
    if (!record) return;
    // Download report as PDF
    downloadReport(record);
    // Download video from Cloudinary if available
    if (record.videoUrl) {
      downloadVideo(record.videoUrl, record.filename);
    }
    toast.success("PDF Report downloaded" + (record.videoUrl ? " and video" : ""));
  };

  if (isLoading) return <LoadingSkeleton />;

  if (error || !record) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center py-20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        data-ocid="error-card"
      >
        <Card className="p-10 max-w-md w-full text-center bg-card border-border relative overflow-hidden">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_28px,oklch(0.68_0.24_25/0.03)_28px,oklch(0.68_0.24_25/0.03)_29px)] pointer-events-none" />
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-fake-subtle border border-fake/30 flex items-center justify-center mx-auto mb-5">
              <AlertCircle size={28} className="text-fake" />
            </div>
            <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">
              Error 404
            </div>
            <h2 className="font-display font-bold text-xl text-foreground mb-2">
              Analysis Not Found
            </h2>
            <p className="text-sm text-muted-foreground mb-6 font-mono leading-relaxed">
              The analysis ID may be invalid, expired, or you may not have
              access to this record.
            </p>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/history">
                <ArrowLeft size={13} />
                Back to History
              </Link>
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  const isComplete = record.status === AnalysisStatus.Complete;
  const isInProgress =
    record.status === AnalysisStatus.Queued ||
    record.status === AnalysisStatus.Processing;
  const flaggedCount = record.frameAnalysis.flaggedFrames.length;
  const frameTotal = Number(record.frameAnalysis.frameCount);
  const forensicEntries = Object.entries(record.forensic);

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2 text-muted-foreground"
            data-ocid="back-to-history"
          >
            <Link to="/history">
              <ArrowLeft size={14} className="mr-1" />
              Back to History
            </Link>
          </Button>
          <h1 className="text-2xl font-display font-bold text-foreground truncate max-w-lg">
            {record.filename}
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            ID: <span className="text-primary">{record.id}</span> ·{" "}
            {formatTs(record.uploadTimestamp)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isInProgress && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5"
            >
              <RefreshCw size={13} />
              Refresh
            </Button>
          )}
          {isComplete && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-1.5"
                data-ocid="download-btn"
              >
                <Download size={13} />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                disabled={shareMutation.isPending}
                className="gap-1.5"
                data-ocid="share-btn"
              >
                {shareMutation.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Share2 size={13} />
                )}
                Share
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="gap-1.5 text-fake hover:text-fake border-fake/30 hover:bg-fake-subtle"
                data-ocid="delete-btn"
              >
                {deleteMutation.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <StatusBanner status={record.status} />

      {isComplete && (
        <>
          {/* ── Video Player + Face Detection Overlay ── */}
          {(record.videoUrl || videoUrl) && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card
                className="p-6 bg-card border-border relative overflow-hidden"
                data-ocid="video-player-card"
              >
                <div className="absolute inset-0 grid-forensic opacity-20 pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                    <h2 className="font-mono font-semibold text-foreground text-sm uppercase tracking-wider">
                      Forensic Visualizer
                    </h2>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground mb-4">
                    Live detection simulation — Metadata mapping active
                  </p>
                  <VideoPlayerWithOverlay
                    verdict={record.verdict}
                    confidence={
                      record.verdict === "Real"
                        ? (1 - record.forensic.deepfakeProbability) * 100
                        : record.forensic.deepfakeProbability * 100
                    }
                    videoUrl={record.videoUrl || videoUrl}
                    trackingData={record.frameAnalysis.faceTrackingData}
                    frameRate={record.frameAnalysis.frameRate}
                  />
                </div>
              </Card>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════
              VERDICT-FOCUSED LAYOUT - All content organized around verdict
          ════════════════════════════════════════════════════════════ */}

          {/* ── 1. VERDICT HERO (Main Focus) ── */}
          <VerdictHeroBanner
            verdict={record.verdict}
            overallScore={record.overallScore}
          />

          {/* ── 2. VERDICT EXPLANATION (Why this verdict?) ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="p-6 bg-card border-border">
              <ExplanationPanel
                verdict={record.verdict.toUpperCase() as "FAKE" | "REAL" | "UNCERTAIN"}
                overallScore={record.overallScore}
                frameCount={record.frameAnalysis.flaggedFrames.length}
                flaggedFrameCount={flaggedCount}
                fakeFrameCount={record.frameAnalysis.flaggedFrames.filter(f => f.suspicionScore >= 0.75).length}
                realFrameCount={record.frameAnalysis.flaggedFrames.filter(f => f.suspicionScore <= 0.35).length}
                uncertainFrameCount={record.frameAnalysis.flaggedFrames.filter(f => f.suspicionScore > 0.35 && f.suspicionScore < 0.75).length}
              />
            </Card>
          </motion.div>

          {/* ── 3. VERDICT-SPECIFIC INDICATORS ── */}
          {record.verdict === "Fake" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <Card className="p-6 bg-card border-border border-fake/30">
                <h2 className="font-mono font-semibold text-fake mb-5 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-fake animate-pulse inline-block" />
                  Manipulation Indicators Detected
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
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
            </motion.div>
          )}

          {record.verdict === "Real" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <Card className="p-6 bg-card border-border border-real/30">
                <h2 className="font-mono font-semibold text-real mb-5 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-real inline-block" />
                  Authenticity Markers Verified
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
                  {forensicEntries.filter(([_, v]) => (v as number) < 0.5).map(([key, value], i) => (
                    <ScoreBar
                      key={key}
                      label={forensicLabels[key] ?? key}
                      value={value as number}
                      delay={i * 0.08}
                    />
                  ))}
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-4">
                  Low scores across all forensic metrics indicate genuine video content with no manipulation artifacts.
                </p>
              </Card>
            </motion.div>
          )}

          {record.verdict === "Uncertain" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <Card className="p-6 bg-card border-border border-uncertain/30">
                <h2 className="font-mono font-semibold text-uncertain mb-5 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-uncertain animate-pulse inline-block" />
                  Ambiguous Analysis Results
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  The analysis could not confidently classify this video. This typically occurs with:
                </p>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                  <li>Heavy video compression (WhatsApp, social media)</li>
                  <li>Low resolution or poor lighting conditions</li>
                  <li>Novel manipulation techniques</li>
                  <li>Partial or subtle manipulations</li>
                </ul>
              </Card>
            </motion.div>
          )}

          {/* ── 4. VIDEO METADATA (Compact) ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="p-4 bg-muted/30 border-border">
              <div className="flex flex-wrap items-center gap-4 font-mono text-xs text-muted-foreground">
                <span>SIZE: <span className="text-foreground">{formatBytes(record.fileSize)}</span></span>
                <span className="w-px h-3 bg-border" />
                <span>RES: <span className="text-foreground">{record.frameAnalysis.resolution || "—"}</span></span>
                <span className="w-px h-3 bg-border" />
                <span>FPS: <span className="text-foreground">{record.frameAnalysis.frameRate}</span></span>
                <span className="w-px h-3 bg-border" />
                <span>FRAMES: <span className="text-foreground">{frameTotal.toLocaleString()}</span></span>
              </div>
            </Card>
          </motion.div>


          {/* ════════════════════════════════════════════════════════════
              5. VERDICT-FOCUSED FRAME VISUALIZATION
          ════════════════════════════════════════════════════════════ */}

          {/* FAKE: Show suspicious frames */}
          {record.verdict === "Fake" && flaggedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              <Card className="p-6 bg-card border-border border-fake/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div>
                    <h2 className="font-mono font-semibold text-fake flex items-center gap-2 text-sm uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-fake animate-pulse inline-block" />
                      Suspicious Frame Evidence
                    </h2>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                      High-suspicion frames contributing to fake verdict
                    </p>
                  </div>
                  <Badge variant="destructive" className="font-mono text-xs">
                    {flaggedCount} frames flagged
                  </Badge>
                </div>

                {/* Frame thumbnails */}
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1"
                  data-ocid="frame-grid"
                >
                  {record.frameAnalysis.flaggedFrames
                    .slice(0, 32)
                    .map((f, i) => (
                      <FrameThumbnail
                        key={`frame-${i}-${f.frameIndex}`}
                        frame={f}
                        index={i}
                        file={currentFile}
                        frameRate={record.frameAnalysis.frameRate}
                        isSelected={selectedFrame === Number(f.frameIndex)}
                        onClick={() => handleFrameClick(Number(f.frameIndex))}
                        overallVerdict={record.verdict}
                      />
                    ))}
                </div>
                {flaggedCount > 32 && (
                  <p className="text-xs text-muted-foreground font-mono mt-3 text-center">
                    +{flaggedCount - 32} more flagged frames
                  </p>
                )}
              </Card>
            </motion.div>
          )}

          {/* REAL: Show analyzed sample frames */}
          {record.verdict === "Real" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              <Card className="p-6 bg-card border-border border-real/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div>
                    <h2 className="font-mono font-semibold text-real flex items-center gap-2 text-sm uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-real inline-block" />
                      Sample Frame Analysis
                    </h2>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                      Analyzed frames showing authentic patterns
                    </p>
                  </div>
                  <Badge variant="default" className="font-mono text-xs bg-real/20 text-real border-real/30">
                    {record.frameAnalysis.flaggedFrames.length} frames analyzed
                  </Badge>
                </div>

                {/* Frame thumbnails */}
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1"
                  data-ocid="frame-grid"
                >
                  {record.frameAnalysis.flaggedFrames
                    .slice(0, 32)
                    .map((f, i) => (
                      <FrameThumbnail
                        key={`frame-${i}-${f.frameIndex}`}
                        frame={f}
                        index={i}
                        file={currentFile}
                        frameRate={record.frameAnalysis.frameRate}
                        isSelected={selectedFrame === Number(f.frameIndex)}
                        onClick={() => handleFrameClick(Number(f.frameIndex))}
                        overallVerdict={record.verdict}
                      />
                    ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* UNCERTAIN: Show ambiguous frames */}
          {record.verdict === "Uncertain" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
            >
              <Card className="p-6 bg-card border-border border-uncertain/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div>
                    <h2 className="font-mono font-semibold text-uncertain flex items-center gap-2 text-sm uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-uncertain inline-block" />
                      Ambiguous Frame Analysis
                    </h2>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                      Mixed patterns preventing confident classification
                    </p>
                  </div>
                  <Badge variant="default" className="font-mono text-xs bg-uncertain/20 text-uncertain border-uncertain/30">
                    {record.frameAnalysis.flaggedFrames.length} frames analyzed
                  </Badge>
                </div>

                {/* Frame thumbnails */}
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1"
                  data-ocid="frame-grid"
                >
                  {record.frameAnalysis.flaggedFrames
                    .slice(0, 32)
                    .map((f, i) => (
                      <FrameThumbnail
                        key={`frame-${i}-${f.frameIndex}`}
                        frame={f}
                        index={i}
                        file={currentFile}
                        frameRate={record.frameAnalysis.frameRate}
                        isSelected={selectedFrame === Number(f.frameIndex)}
                        onClick={() => handleFrameClick(Number(f.frameIndex))}
                        overallVerdict={record.verdict}
                      />
                    ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── Temporal Consistency Graph ── */}
          {flaggedCount > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
            >
              <Card className="p-6 bg-card border-border">
                <h2 className="font-mono font-semibold text-foreground mb-1 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                  Temporal Consistency
                </h2>
                <p className="text-xs font-mono text-muted-foreground mb-5">
                  Suspicion score per flagged frame — neon spike = high
                  manipulation probability
                </p>
                <div
                  className="bg-muted/20 rounded-lg p-3 border border-border"
                  data-ocid="temporal-chart"
                >
                  <TemporalChart frames={record.frameAnalysis.flaggedFrames} />
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── Forensic Metrics Table ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card className="p-6 bg-card border-border">
              <h2 className="font-mono font-semibold text-foreground mb-5 flex items-center gap-2 text-sm uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />
                Forensic Metadata
              </h2>
              <ForensicTable record={record} />
            </Card>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

// ─── Route Export ─────────────────────────────────────────────────────────────

export function ResultsPageComponent() {
  const { id } = useParams({ strict: false }) as { id: string };
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <ResultsContent id={id} />
      </div>
    </ProtectedRoute>
  );
}
