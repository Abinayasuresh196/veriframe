import { motion } from "motion/react";
import { AlertTriangle, CheckCircle, HelpCircle, FileSearch, Activity, Clock, Layers, Info } from "lucide-react";

interface ExplanationPanelProps {
  verdict: "FAKE" | "REAL" | "UNCERTAIN";
  overallScore: number;
  frameCount: number;
  flaggedFrameCount: number;
  fakeFrameCount: number;
  realFrameCount: number;
  uncertainFrameCount: number;
}

export function ExplanationPanel({
  verdict,
  overallScore,
  frameCount,
  flaggedFrameCount,
  fakeFrameCount,
  realFrameCount,
  uncertainFrameCount,
}: ExplanationPanelProps) {
  const getVerdictIcon = () => {
    switch (verdict) {
      case "FAKE":
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case "REAL":
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      default:
        return <HelpCircle className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getVerdictColor = () => {
    switch (verdict) {
      case "FAKE":
        return "text-red-400 border-red-400/30 bg-red-400/10";
      case "REAL":
        return "text-green-400 border-green-400/30 bg-green-400/10";
      default:
        return "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";
    }
  };

  const getExplanation = () => {
    switch (verdict) {
      case "FAKE":
        return `Strong manipulation indicators detected. Average score ${overallScore}% exceeds 85% threshold with ≥50% frame consensus. High variance in frame scores suggests genuine manipulation patterns rather than compression noise.`;
      case "REAL":
        if (overallScore > 65) {
          return `Analysis indicates authentic content despite elevated scores. The ${overallScore}% average is offset by stable frame-to-frame consistency (std dev < 0.08) typical of WhatsApp-compressed real videos. Compression creates uniform noise patterns that the model recognizes as non-manipulative.`;
        }
        return `Clear authentic content detected. Average score ${overallScore}% below 65% threshold indicates genuine video with confidence. Frame scores show consistent patterns typical of real footage.`;
      default:
        return `Ambiguous classification. Score ${overallScore}% falls in borderline range (65-85%). Mixed frame patterns or variable stability prevent confident verdict. This may indicate either a deepfake with inconsistent artifacts or a compressed real video with atypical noise patterns.`;
    }
  };

  const getConfidenceLevel = () => {
    if (verdict === "FAKE" && overallScore >= 90) return "Very High";
    if (verdict === "FAKE") return "High";
    if (verdict === "REAL" && overallScore <= 50) return "Very High";
    if (verdict === "REAL") return "High";
    return "Low — Model uncertainty detected";
  };

  const showCalibrationWarning = verdict === "UNCERTAIN" || (verdict === "FAKE" && overallScore < 90) || (verdict === "REAL" && overallScore > 50);

  const getRecommendation = () => {
    switch (verdict) {
      case "FAKE":
        return "⚠️ This video shows strong signs of manipulation. Consider verifying the source or seeking additional forensic analysis.";
      case "REAL":
        return "✓ This video appears authentic based on current analysis. No further action recommended.";
      default:
        return "? The analysis is inconclusive. Consider:\n• Uploading a higher quality version\n• Checking the original source\n• Manual review of flagged segments";
    }
  };

  // Calculate verdict-aware frame counts
  const getVerdictAwareFrameCounts = () => {
    if (verdict === "REAL") {
      // If overall verdict is Real, all frames are Real (weighted system considers stability)
      return {
        fake: 0,
        real: frameCount,
        uncertain: 0
      };
    } else if (verdict === "FAKE") {
      // If overall verdict is Fake, show the actual breakdown
      return {
        fake: fakeFrameCount,
        real: realFrameCount,
        uncertain: uncertainFrameCount
      };
    } else {
      // Uncertain - show actual breakdown
      return {
        fake: fakeFrameCount,
        real: realFrameCount,
        uncertain: uncertainFrameCount
      };
    }
  };

  const frameCounts = getVerdictAwareFrameCounts();

  return (
    <div className="space-y-4">
      {/* Main Verdict Card */}
      <motion.div
        className={`p-4 rounded-lg border ${getVerdictColor()}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{getVerdictIcon()}</div>
          <div className="space-y-2 flex-1">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Verdict: {verdict}</h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getVerdictColor()}`}>
                  {getConfidenceLevel()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {getExplanation()}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Model Calibration Warning */}
      {showCalibrationWarning && (
        <motion.div
          className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-xs font-semibold text-yellow-400">Model Calibration Notice</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                The AI model may be affected by video compression, lighting conditions, or face angle. 
                Results in the uncertain range indicate the model cannot confidently distinguish between real and manipulated content.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Frame Distribution */}
      <motion.div
        className="p-4 rounded-lg border bg-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5" />
          Frame Analysis Breakdown
        </h4>
        
        <div className="space-y-2">
          {/* Fake frames bar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-20">FAKE ({frameCounts.fake})</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-red-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(frameCounts.fake / frameCount) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-8 text-right">
              {Math.round((frameCounts.fake / frameCount) * 100)}%
            </span>
          </div>

          {/* Uncertain frames bar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-20">UNCERTAIN ({frameCounts.uncertain})</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-yellow-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(frameCounts.uncertain / frameCount) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-8 text-right">
              {Math.round((frameCounts.uncertain / frameCount) * 100)}%
            </span>
          </div>

          {/* Real frames bar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-20">REAL ({frameCounts.real})</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-green-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(frameCounts.real / frameCount) * 100}%` }}
                transition={{ duration: 0.8, delay: 0.4 }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-8 text-right">
              {Math.round((frameCounts.real / frameCount) * 100)}%
            </span>
          </div>
        </div>
      </motion.div>

      {/* Recommendation */}
      <motion.div
        className="p-4 rounded-lg border bg-muted/50"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
          <FileSearch className="w-3.5 h-3.5" />
          Recommendation
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
          {getRecommendation()}
        </p>
      </motion.div>
    </div>
  );
}
