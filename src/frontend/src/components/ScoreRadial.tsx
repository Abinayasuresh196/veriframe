import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface ScoreRadialProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showValue?: boolean;
  className?: string;
  animate?: boolean;
}

function getScoreColor(score: number): string {
  if (score <= 30) return "oklch(0.72 0.2 160)"; // green/real
  if (score <= 65) return "oklch(0.78 0.18 75)"; // amber/uncertain
  return "oklch(0.68 0.24 25)"; // red/fake
}

function getScoreLabel(score: number): string {
  if (score <= 30) return "Low Risk";
  if (score <= 65) return "Moderate";
  return "High Risk";
}

export function ScoreRadial({
  score,
  size = 120,
  strokeWidth = 8,
  label,
  showValue = true,
  className,
  animate = true,
}: ScoreRadialProps) {
  const [displayScore, setDisplayScore] = useState(animate ? 0 : score);
  const animRef = useRef<number | null>(null);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(100, Math.max(0, score));
  const displayOffset = circumference - (displayScore / 100) * circumference;

  const color = getScoreColor(clampedScore);
  const cx = size / 2;
  const cy = size / 2;

  useEffect(() => {
    if (!animate) {
      setDisplayScore(score);
      return;
    }
    const start = performance.now();
    const duration = 1200;
    const startVal = 0;
    const endVal = clampedScore;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayScore(Math.round(startVal + (endVal - startVal) * eased));
      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      }
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [score, animate, clampedScore]);

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
      data-ocid="score-radial"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-labelledby="score-radial-title"
        role="img"
      >
        <title id="score-radial-title">{`Risk score: ${clampedScore} out of 100`}</title>
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="oklch(0.25 0.018 260)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={displayOffset}
          style={{
            transition: animate
              ? "none"
              : "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)",
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showValue && (
          <>
            <span
              className="font-mono font-bold leading-none"
              style={{
                fontSize: size * 0.22,
                color,
              }}
            >
              {Math.round(displayScore)}
            </span>
            <span
              className="font-mono text-muted-foreground leading-none mt-0.5"
              style={{ fontSize: size * 0.1 }}
            >
              {label ?? getScoreLabel(clampedScore)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
