import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  Film,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { VerdictBadge } from "../components/VerdictBadge";
import { useAuthContext } from "../contexts/AuthContext";
import {
  useDeleteAnalysisRecord,
  useGetUserHistory,
} from "../hooks/useAnalysis";
import { type AnalysisRecord, AnalysisStatus, Verdict } from "../lib/types";
import { useAnalysisStore } from "../stores/analysisStore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = undefined;

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

type SortKey = "date" | "score" | "verdict" | "filename";
type SortDir = "asc" | "desc";
type DateRange = "all" | "7d" | "30d" | "90d";

const FILTER_LABELS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "real", label: "Authentic" },
  { value: "uncertain", label: "Uncertain" },
  { value: "fake", label: "Manipulated" },
];

const DATE_RANGE_LABELS: { value: DateRange; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

const VERDICT_MAP: Record<string, Verdict | null> = {
  all: null,
  real: Verdict.Real,
  uncertain: Verdict.Uncertain,
  fake: Verdict.Fake,
};

const VERDICT_SORT_ORDER: Record<Verdict, number> = {
  [Verdict.Fake]: 0,
  [Verdict.Uncertain]: 1,
  [Verdict.Real]: 2,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: bigint): string {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(ts: bigint): { date: string; time: string } {
  const d = new Date(Number(ts) / 1_000_000);
  return {
    date: d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

function getInitials(filename: string): string {
  const name = filename.replace(/\.[^.]+$/, "");
  const parts = name.split(/[\s_\-.]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getThumbnailColors(verdict: Verdict): string {
  if (verdict === Verdict.Real) return "bg-real-subtle border-real";
  if (verdict === Verdict.Fake) return "bg-fake-subtle border-fake";
  return "bg-uncertain-subtle border-uncertain";
}

function getInitialTextColor(verdict: Verdict): string {
  if (verdict === Verdict.Real) return "text-real";
  if (verdict === Verdict.Fake) return "text-fake";
  return "text-uncertain";
}

function getDateThreshold(range: DateRange): number | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function exportToPDF(records: AnalysisRecord[]): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Title section
  doc.setFontSize(20);
  doc.setTextColor(59, 130, 246); // Blue color
  doc.text("VeriFrame Forensic Analysis Report", pageWidth / 2, 20, { align: "center" });
  
  // Metadata
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Export Date: ${new Date().toLocaleDateString()}`, pageWidth / 2, 28, { align: "center" });
  doc.text(`Total Records: ${records.length}`, pageWidth / 2, 34, { align: "center" });
  
  // Main analysis table
  const headers = [
    ["Filename", "Date", "Size", "Status", "Verdict", "Score %", "Frames", "Flagged", "Anomaly %"],
  ];
  
  const data = records.map((r) => {
    const d = new Date(Number(r.uploadTimestamp) / 1_000_000);
    const fileSizeMB = (Number(r.fileSize) / (1024 * 1024)).toFixed(2);
    const confidence = r.verdict === "Real" 
      ? ((1 - r.forensic.deepfakeProbability) * 100).toFixed(1)
      : (r.forensic.deepfakeProbability * 100).toFixed(1);
    
    return [
      r.filename.substring(0, 30) + (r.filename.length > 30 ? "..." : ""),
      d.toLocaleDateString(),
      `${fileSizeMB} MB`,
      r.status,
      r.verdict,
      `${confidence}%`,
      String(r.frameAnalysis.frameCount),
      String(r.frameAnalysis.flaggedFrames.length),
      `${(r.frameAnalysis.colorAnomalyScore * 100).toFixed(1)}%`,
    ];
  });
  
  autoTable(doc, {
    head: headers,
    body: data,
    startY: 45,
    theme: "grid",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
  });
  
  // Flagged frames section
  const flaggedFrames = records.flatMap((r) =>
    r.frameAnalysis.flaggedFrames.map((f) => ({
      analysisId: r.id,
      filename: r.filename.substring(0, 20),
      frameIndex: f.frameIndex,
      suspicion: (f.suspicionScore * 100).toFixed(1),
      verdict: f.suspicionScore >= 0.65 ? "FAKE" : f.suspicionScore >= 0.35 ? "UNCERTAIN" : "REAL",
    }))
  );
  
  if (flaggedFrames.length > 0) {
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text("Flagged Frame Details", 14, finalY);
    
    const frameHeaders = [["Analysis ID", "Filename", "Frame #", "Suspicion %", "Verdict"]];
    const frameData = flaggedFrames.map((f) => [
      f.analysisId.substring(0, 8),
      f.filename,
      String(f.frameIndex),
      `${f.suspicion}%`,
      f.verdict,
    ]) as string[][];
    
    autoTable(doc, {
      head: frameHeaders,
      body: frameData,
      startY: finalY + 5,
      theme: "grid",
      headStyles: {
        fillColor: [239, 68, 68], // Red for flagged frames
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold",
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [254, 242, 242],
      },
    });
  }
  
  // Footer
  const pageCount = (doc as any).internal.pages.length - 1; // pages array includes page 1 at index 1
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
  
  doc.save(`veriframe-forensic-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-0 border border-border rounded-lg overflow-hidden">
      <div className="bg-muted/30 border-b border-border px-4 py-3 flex gap-4">
        {[120, 80, 60, 90, 100].map((w) => (
          <Skeleton key={w} className="h-3" style={{ width: w }} />
        ))}
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="px-4 py-4 border-b border-border/50 last:border-0 flex items-center gap-4"
        >
          <Skeleton className="h-10 w-10 rounded flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-2 w-32" />
          </div>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-7 w-24" />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-lg p-4 space-y-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2 w-28" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, verdict }: { score: number; verdict: Verdict }) {
  const pct = Math.round(score * 100);
  const barClass =
    verdict === Verdict.Fake
      ? "bg-fake"
      : verdict === Verdict.Real
        ? "bg-real"
        : "bg-uncertain";

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="font-mono text-xs text-foreground tabular-nums w-8 flex-shrink-0">
        {pct}%
      </span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-0">
        <motion.div
          className={`h-full rounded-full ${barClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        />
      </div>
    </div>
  );
}

// ─── Delete Confirmation ──────────────────────────────────────────────────────

function DeleteConfirmRow({
  onConfirm,
  onCancel,
  isDeleting,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="flex items-center justify-end gap-2 px-4 py-2 bg-fake-subtle border-t border-fake/20">
        <span className="text-xs font-mono text-fake mr-2">
          Confirm deletion?
        </span>
        <Button
          size="sm"
          variant="destructive"
          className="h-7 px-3 text-xs font-mono"
          onClick={onConfirm}
          disabled={isDeleting}
          data-ocid="confirm-delete-btn"
        >
          {isDeleting ? (
            <Loader2 size={12} className="animate-spin mr-1" />
          ) : null}
          Delete
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-3 text-xs font-mono"
          onClick={onCancel}
          disabled={isDeleting}
          data-ocid="cancel-delete-btn"
        >
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Desktop Table ────────────────────────────────────────────────────────────

type SortState = { key: SortKey; dir: SortDir };

function SortIcon({
  colKey,
  sort,
}: {
  colKey: SortKey;
  sort: SortState;
}) {
  if (sort.key !== colKey)
    return <ArrowUpDown size={12} className="text-muted-foreground/50 ml-1" />;
  return sort.dir === "asc" ? (
    <ChevronUp size={12} className="text-primary ml-1" />
  ) : (
    <ChevronDown size={12} className="text-primary ml-1" />
  );
}

function DesktopTable({
  records,
  sort,
  onSort,
  onDelete,
  pendingDeleteId,
  onConfirmDelete,
  onCancelDelete,
  deletingId,
}: {
  records: AnalysisRecord[];
  sort: SortState;
  onSort: (key: SortKey) => void;
  onDelete: (id: string) => void;
  pendingDeleteId: string | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  deletingId: string | null;
}) {
  const thClass =
    "px-4 py-3 text-left text-xs font-mono text-muted-foreground uppercase tracking-widest select-none cursor-pointer hover:text-foreground transition-colors whitespace-nowrap";

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 border-b border-border">
          <tr>
            <th className={`${thClass} w-12 cursor-default`} scope="col" />
            <th
              className={thClass}
              scope="col"
              aria-sort={
                sort.key === "filename"
                  ? sort.dir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              <button
                type="button"
                className="flex items-center w-full"
                onClick={() => onSort("filename")}
                onKeyDown={(e) => e.key === "Enter" && onSort("filename")}
              >
                File <SortIcon colKey="filename" sort={sort} />
              </button>
            </th>
            <th
              className={thClass}
              scope="col"
              aria-sort={
                sort.key === "date"
                  ? sort.dir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              <button
                type="button"
                className="flex items-center w-full"
                onClick={() => onSort("date")}
                onKeyDown={(e) => e.key === "Enter" && onSort("date")}
              >
                Date <SortIcon colKey="date" sort={sort} />
              </button>
            </th>
            <th className={`${thClass} hidden lg:table-cell`} scope="col">
              Size
            </th>
            <th
              className={thClass}
              scope="col"
              aria-sort={
                sort.key === "verdict"
                  ? sort.dir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              <button
                type="button"
                className="flex items-center w-full"
                onClick={() => onSort("verdict")}
                onKeyDown={(e) => e.key === "Enter" && onSort("verdict")}
              >
                Verdict <SortIcon colKey="verdict" sort={sort} />
              </button>
            </th>
            <th
              className={thClass}
              scope="col"
              aria-sort={
                sort.key === "score"
                  ? sort.dir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
            >
              <button
                type="button"
                className="flex items-center w-full"
                onClick={() => onSort("score")}
                onKeyDown={(e) => e.key === "Enter" && onSort("score")}
              >
                Score <SortIcon colKey="score" sort={sort} />
              </button>
            </th>
            <th className={`${thClass} cursor-default text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, i) => {
            const { date, time } = formatDate(record.uploadTimestamp);
            const initials = getInitials(record.filename);

            return (
              <motion.tr
                key={record.id}
                data-ocid="history-row"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors group"
              >
                <td className="px-4 py-3">
                  <div
                    className={`w-10 h-10 rounded border flex items-center justify-center flex-shrink-0 font-mono text-xs font-bold ${getThumbnailColors(record.verdict)} ${getInitialTextColor(record.verdict)}`}
                  >
                    {initials}
                  </div>
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  <p className="font-medium text-foreground truncate text-sm">
                    {record.filename}
                  </p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <p className="text-xs font-mono text-foreground">{date}</p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {time}
                  </p>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs font-mono text-muted-foreground">
                    {formatFileSize(record.fileSize)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {record.status === AnalysisStatus.Complete ? (
                    <VerdictBadge
                      verdict={record.verdict}
                      size="sm"
                      showPulse={false}
                    />
                  ) : (
                    <span className="text-xs font-mono text-muted-foreground">
                      —
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 min-w-[120px]">
                  {record.status === AnalysisStatus.Complete ? (
                    <ScoreBar
                      score={record.overallScore}
                      verdict={record.verdict}
                    />
                  ) : (
                    <span className="text-xs font-mono text-muted-foreground">
                      —
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs font-mono gap-1 transition-opacity"
                      data-ocid="view-result-btn"
                    >
                      <Link to="/results/$id" params={{ id: record.id }}>
                        <ExternalLink size={12} />
                        View
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-fake transition-smooth"
                      onClick={() => onDelete(record.id)}
                      disabled={deletingId === record.id}
                      data-ocid="delete-record-btn"
                      aria-label="Delete record"
                    >
                      {deletingId === record.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </Button>
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>

      <AnimatePresence>
        {pendingDeleteId && (
          <DeleteConfirmRow
            onConfirm={onConfirmDelete}
            onCancel={onCancelDelete}
            isDeleting={deletingId !== null}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Mobile Card ──────────────────────────────────────────────────────────────

function MobileCard({
  record,
  index,
  onDelete,
  pendingDeleteId,
  onConfirmDelete,
  onCancelDelete,
  deletingId,
}: {
  record: AnalysisRecord;
  index: number;
  onDelete: (id: string) => void;
  pendingDeleteId: string | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  deletingId: string | null;
}) {
  const { date, time } = formatDate(record.uploadTimestamp);
  const initials = getInitials(record.filename);
  const isPending = pendingDeleteId === record.id;

  return (
    <motion.div
      data-ocid="history-row"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
    >
      <Card className="bg-card border-border hover:border-primary/30 transition-smooth overflow-hidden">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded border flex items-center justify-center flex-shrink-0 font-mono text-xs font-bold ${getThumbnailColors(record.verdict)} ${getInitialTextColor(record.verdict)}`}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate text-sm">
                {record.filename}
              </p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                {date} · {time} · {formatFileSize(record.fileSize)}
              </p>
            </div>
            {record.status === AnalysisStatus.Complete && (
              <VerdictBadge
                verdict={record.verdict}
                size="sm"
                showPulse={false}
              />
            )}
          </div>

          {record.status === AnalysisStatus.Complete && (
            <div className="mt-3">
              <ScoreBar score={record.overallScore} verdict={record.verdict} />
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
            <span className="text-xs font-mono text-muted-foreground">
              {record.status}
            </span>
            <div className="flex gap-1">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs font-mono gap-1"
                data-ocid="view-result-btn"
              >
                <Link to="/results/$id" params={{ id: record.id }}>
                  <ExternalLink size={12} />
                  View
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-fake transition-smooth"
                onClick={() => onDelete(record.id)}
                disabled={deletingId === record.id}
                aria-label="Delete record"
                data-ocid="delete-record-btn"
              >
                {deletingId === record.id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
              </Button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isPending && (
            <DeleteConfirmRow
              onConfirm={onConfirmDelete}
              onCancel={onCancelDelete}
              isDeleting={deletingId !== null}
            />
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ hasRecords }: { hasRecords: boolean }) {
  const { principal } = useAuthContext();
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      data-ocid="empty-state"
      className="relative overflow-hidden rounded-lg border border-border bg-card"
    >
      {/* Grid overlay */}
      <div className="absolute inset-0 grid-forensic opacity-60 pointer-events-none" />
      {/* Scan line */}
      <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-scan pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center justify-center py-20 px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-muted/50 border border-border flex items-center justify-center mb-6">
          <Film size={28} className="text-muted-foreground" />
        </div>

        {hasRecords ? (
          <>
            <p className="font-mono text-xs text-primary uppercase tracking-widest mb-2">
              No Matches Found
            </p>
            <h3 className="text-lg font-display font-semibold text-foreground mb-2">
              No analyses match your filters
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Try adjusting your search query, verdict filter, or date range.
            </p>
          </>
        ) : (
          <>
            <p className="font-mono text-xs text-primary uppercase tracking-widest mb-2">
              Forensic Database Empty
            </p>
            <h3 className="text-lg font-display font-semibold text-foreground mb-2">
              No analyses on record
            </h3>
            <p className="text-sm text-muted-foreground mb-8 max-w-xs">
              Submit your first video for deep forensic analysis and
              manipulation detection.
            </p>

            {/* Principal display for debugging */}
            <div className="mb-8 p-3 rounded bg-muted/30 border border-border/30">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Authenticated ID</p>
              <p className="text-xs font-mono text-foreground break-all max-w-[280px]">
                {principal?.toString() || "Anonymous (2vxsx-fae)"}
              </p>
            </div>

            <Button
              asChild
              className="gap-2 bg-primary text-primary-foreground glow-primary"
              data-ocid="upload-cta-btn"
            >
              <Link to="/upload">
                <Upload size={15} />
                Upload Your First Video
              </Link>
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <div
      className="flex items-center justify-between mt-4"
      data-ocid="pagination"
    >
      <span className="text-xs font-mono text-muted-foreground">
        {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onPrev}
          disabled={page === 1}
          aria-label="Previous page"
          data-ocid="pagination-prev"
        >
          <ChevronLeft size={14} />
        </Button>
        <span className="text-xs font-mono text-foreground px-2">
          {page} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onNext}
          disabled={page === totalPages}
          aria-label="Next page"
          data-ocid="pagination-next"
        >
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

function HistoryContent() {
  const { data: records, isLoading, error, refetch } = useGetUserHistory();
  const deleteMutation = useDeleteAnalysisRecord();
  const { selectedHistoryFilter, setSelectedHistoryFilter } =
    useAnalysisStore();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [sort, setSort] = useState<SortState>({ key: "date", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 on filter/search/date change
  const filterKey = `${selectedHistoryFilter}|${debouncedSearch}|${dateRange}`;
  const prevFilterKeyRef = useRef(filterKey);
  if (prevFilterKeyRef.current !== filterKey) {
    prevFilterKeyRef.current = filterKey;
    setPage(1);
  }

  // Close date dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dateDropdownRef.current &&
        !dateDropdownRef.current.contains(e.target as Node)
      ) {
        setShowDateDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "date" ? "desc" : "asc" },
    );
  }, []);

  const handleDeleteRequest = useCallback((id: string) => {
    setPendingDeleteId(id);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Record deleted", {
        description: "Forensic record removed from database.",
      });
      setPendingDeleteId(null);
    } catch {
      toast.error("Delete failed", {
        description: "Could not remove record. Try again.",
      });
    } finally {
      setDeletingId(null);
    }
  }, [pendingDeleteId, deleteMutation]);

  const handleCancelDelete = useCallback(() => {
    setPendingDeleteId(null);
  }, []);

  // Filter + sort
  const filtered = useMemo(() => {
    const threshold = getDateThreshold(dateRange);
    const targetVerdict = VERDICT_MAP[selectedHistoryFilter];

    return (records ?? [])
      .filter((r) => {
        if (targetVerdict !== null && r.verdict !== targetVerdict) return false;
        if (
          debouncedSearch &&
          !r.filename.toLowerCase().includes(debouncedSearch.toLowerCase())
        )
          return false;
        if (threshold !== null) {
          const ts = Number(r.uploadTimestamp) / 1_000_000;
          if (ts < threshold) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sort.key === "date") {
          cmp = Number(a.uploadTimestamp) - Number(b.uploadTimestamp);
        } else if (sort.key === "score") {
          cmp = a.overallScore - b.overallScore;
        } else if (sort.key === "verdict") {
          cmp = VERDICT_SORT_ORDER[a.verdict] - VERDICT_SORT_ORDER[b.verdict];
        } else if (sort.key === "filename") {
          cmp = a.filename.localeCompare(b.filename);
        }
        return sort.dir === "asc" ? cmp : -cmp;
      });
  }, [records, selectedHistoryFilter, debouncedSearch, dateRange, sort]);

  // Counts per filter tab
  const filterCounts = useMemo(() => {
    const all = records ?? [];
    return {
      all: all.length,
      real: all.filter((r) => r.verdict === Verdict.Real).length,
      uncertain: all.filter((r) => r.verdict === Verdict.Uncertain).length,
      fake: all.filter((r) => r.verdict === Verdict.Fake).length,
    };
  }, [records]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const currentDateLabel =
    DATE_RANGE_LABELS.find((d) => d.value === dateRange)?.label ?? "All time";

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 max-w-6xl">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <span className="font-mono text-xs text-primary uppercase tracking-widest mb-1 block">
            Forensic Database
          </span>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                Analysis History
              </h1>
              {!isLoading && records && (
                <p className="text-sm text-muted-foreground font-mono mt-1">
                  {records.length} record{records.length !== 1 ? "s" : ""} in
                  database
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {filtered.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 font-mono text-xs border-border hover:border-primary/50"
                  onClick={() => exportToPDF(filtered)}
                  data-ocid="export-pdf-btn"
                >
                  <Download size={13} />
                  Download Report
                </Button>
              )}
              <Button
                asChild
                size="sm"
                className="gap-1.5 bg-primary text-primary-foreground glow-primary"
                data-ocid="new-analysis-btn"
              >
                <Link to="/upload">
                  <Upload size={14} />
                  Analyze New Video
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Filter Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="flex flex-wrap gap-1 mb-4"
          data-ocid="history-filter"
        >
          {FILTER_LABELS.map(({ value, label }) => {
            const count = filterCounts[value as keyof typeof filterCounts];
            const isActive = selectedHistoryFilter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setSelectedHistoryFilter(
                    value as "all" | "real" | "uncertain" | "fake",
                  )
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-smooth ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted border border-border"
                }`}
                data-ocid={`filter-tab-${value}`}
              >
                {label}
                {!isLoading && (
                  <span
                    className={`rounded px-1 py-0.5 text-[10px] leading-none ${
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>

        {/* Search + Date Range */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="flex flex-col sm:flex-row gap-3 mb-6"
        >
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              placeholder="Search by filename…"
              className="pl-9 font-mono text-sm bg-card border-border focus-visible:ring-primary/50 focus-visible:border-primary/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-ocid="history-search"
            />
          </div>

          {/* Date range dropdown */}
          <div className="relative flex-shrink-0" ref={dateDropdownRef}>
            <button
              type="button"
              className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-card text-sm font-mono text-foreground hover:border-primary/40 transition-smooth w-full sm:w-auto"
              onClick={() => setShowDateDropdown((v) => !v)}
              data-ocid="date-range-select"
            >
              <Clock
                size={13}
                className="text-muted-foreground flex-shrink-0"
              />
              <span className="truncate">{currentDateLabel}</span>
              <ChevronDown
                size={13}
                className={`ml-auto flex-shrink-0 text-muted-foreground transition-transform ${showDateDropdown ? "rotate-180" : ""}`}
              />
            </button>
            <AnimatePresence>
              {showDateDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 z-20 w-44 bg-popover border border-border rounded-md shadow-lg overflow-hidden"
                  data-ocid="date-range-dropdown"
                >
                  {DATE_RANGE_LABELS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm font-mono transition-colors hover:bg-muted ${
                        dateRange === value
                          ? "text-primary bg-primary/10"
                          : "text-foreground"
                      }`}
                      onClick={() => {
                        setDateRange(value);
                        setShowDateDropdown(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <>
            <div className="hidden md:block">
              <TableSkeleton />
            </div>
            <div className="md:hidden">
              <CardSkeleton />
            </div>
          </>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-destructive/5 border-destructive/20">
            <AlertCircle className="w-12 h-12 mb-4 text-destructive opacity-50" />
            <h3 className="text-lg font-bold mb-2">Failed to load history</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              There was an error connecting to the forensic database. Please ensure your backend is running.
            </p>
            <Button onClick={() => refetch()} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Try Again
            </Button>
          </div>
        ) : paginated.length === 0 ? (
          <EmptyState hasRecords={(records?.length ?? 0) > 0} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <DesktopTable
                records={paginated}
                sort={sort}
                onSort={handleSort}
                onDelete={handleDeleteRequest}
                pendingDeleteId={pendingDeleteId}
                onConfirmDelete={handleConfirmDelete}
                onCancelDelete={handleCancelDelete}
                deletingId={deletingId}
              />
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {paginated.map((record, i) => (
                <MobileCard
                  key={record.id}
                  record={record}
                  index={i}
                  onDelete={handleDeleteRequest}
                  pendingDeleteId={pendingDeleteId}
                  onConfirmDelete={handleConfirmDelete}
                  onCancelDelete={handleCancelDelete}
                  deletingId={deletingId}
                />
              ))}
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={filtered.length}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          </>
        )}
      </div>
    </div>
  );
}

export function HistoryPageComponent() {
  return (
    <ProtectedRoute>
      <HistoryContent />
    </ProtectedRoute>
  );
}
