import { useMemo } from "react";
import { motion } from "motion/react";
import { AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";

interface TimelineSegment {
  startFrame: number;
  endFrame: number;
  verdict: "FAKE" | "REAL" | "UNCERTAIN";
  avgScore: number;
}

interface TimelineViewProps {
  frames: Array<{
    frameIndex: number | bigint;
    suspicionScore: number;
  }>;
  totalFrames: number;
  frameRate: number;
  onFrameClick?: (frameIndex: number) => void;
  selectedFrame?: number | null;
}

export function TimelineView({ frames, totalFrames, frameRate, onFrameClick, selectedFrame }: TimelineViewProps) {
  const segments = useMemo(() => {
    if (!frames || frames.length === 0) return [];

    // Sort frames by index (convert bigint to number)
    const sortedFrames = [...frames]
      .map(f => ({ ...f, frameIndex: Number(f.frameIndex) }))
      .sort((a, b) => a.frameIndex - b.frameIndex);
    
    // Group consecutive frames with similar verdicts
    const segs: TimelineSegment[] = [];
    let currentSeg: TimelineSegment | null = null;

    for (const frame of sortedFrames) {
      const score = frame.suspicionScore;
      let verdict: "FAKE" | "REAL" | "UNCERTAIN";
      
      if (score >= 0.75) verdict = "FAKE";
      else if (score <= 0.35) verdict = "REAL";
      else verdict = "UNCERTAIN";

      if (!currentSeg || currentSeg.verdict !== verdict) {
        if (currentSeg) segs.push(currentSeg);
        currentSeg = {
          startFrame: frame.frameIndex,
          endFrame: frame.frameIndex,
          verdict,
          avgScore: score,
        };
      } else {
        currentSeg.endFrame = frame.frameIndex;
        currentSeg.avgScore = (currentSeg.avgScore + score) / 2;
      }
    }
    
    if (currentSeg) segs.push(currentSeg);
    return segs;
  }, [frames]);

  const formatTime = (frameNum: number) => {
    const seconds = frameNum / frameRate;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "FAKE":
        return "bg-red-500 border-red-400";
      case "REAL":
        return "bg-green-500 border-green-400";
      default:
        return "bg-yellow-500 border-yellow-400";
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case "FAKE":
        return <AlertTriangle className="w-3 h-3 text-red-400" />;
      case "REAL":
        return <CheckCircle className="w-3 h-3 text-green-400" />;
      default:
        return <HelpCircle className="w-3 h-3 text-yellow-400" />;
    }
  };

  if (segments.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        No frame analysis data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Timeline ruler */}
      <div className="relative">
        {/* Time markers */}
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono mb-1">
          <span>0:00</span>
          <span>{formatTime(totalFrames / 2)}</span>
          <span>{formatTime(totalFrames)}</span>
        </div>
        
        {/* Timeline bar */}
        <div className="h-8 bg-muted/50 rounded-lg overflow-hidden flex relative">
          {segments.map((seg, idx) => {
            const startPct = (seg.startFrame / totalFrames) * 100;
            const widthPct = ((seg.endFrame - seg.startFrame) / totalFrames) * 100;
            
            const isSelected = selectedFrame != null && 
              selectedFrame >= seg.startFrame && 
              selectedFrame <= seg.endFrame;
            
            return (
              <motion.div
                key={idx}
                className={`h-full ${getVerdictColor(seg.verdict)} border-r last:border-r-0 relative group cursor-pointer transition-all duration-200 hover:brightness-110 ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-background z-10' : ''}`}
                style={{ 
                  left: `${startPct}%`,
                  width: `${Math.max(widthPct, 0.5)}%`,
                  position: "absolute"
                }}
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: idx * 0.1, duration: 0.3 }}
                onClick={() => onFrameClick?.(seg.startFrame)}
                whileHover={{ scaleY: 1.1 }}
                whileTap={{ scaleY: 0.95 }}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <motion.div 
                    className="absolute inset-0 bg-white/30"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  />
                )}
                
                {/* Pulse animation for fake segments */}
                {seg.verdict === "FAKE" && (
                  <div className="absolute inset-0 animate-pulse bg-red-400/20" />
                )}
                
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                  <div className="bg-popover text-popover-foreground text-xs p-2 rounded-md shadow-lg whitespace-nowrap font-mono border border-border">
                    <div className="flex items-center gap-1.5 mb-1">
                      {getVerdictIcon(seg.verdict)}
                      <span className="font-bold">{seg.verdict}</span>
                    </div>
                    <div className="text-muted-foreground">
                      {formatTime(seg.startFrame)} - {formatTime(seg.endFrame)}
                    </div>
                    <div className="text-muted-foreground">
                      Score: {Math.round(seg.avgScore * 100)}%
                    </div>
                    <div className="text-[10px] text-primary mt-1">
                      Click to jump to frame
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 justify-center text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span className="text-muted-foreground">FAKE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-500" />
          <span className="text-muted-foreground">UNCERTAIN</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-muted-foreground">REAL</span>
        </div>
      </div>
    </div>
  );
}
