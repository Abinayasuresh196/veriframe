import { cn } from "@/lib/utils";
import { Shield, ShieldAlert, ShieldQuestion } from "lucide-react";
import { motion } from "motion/react";
import { Verdict } from "../lib/types";

interface VerdictBadgeProps {
  verdict: Verdict;
  size?: "sm" | "md" | "lg";
  showPulse?: boolean;
  className?: string;
}

const verdictConfig = {
  [Verdict.Real]: {
    label: "AUTHENTIC",
    icon: Shield,
    classes: "bg-real-subtle text-real border-real",
    pulseClass: "pulse-neon",
  },
  [Verdict.Uncertain]: {
    label: "UNCERTAIN",
    icon: ShieldQuestion,
    classes: "bg-uncertain-subtle text-uncertain border-uncertain",
    pulseClass: "",
  },
  [Verdict.Fake]: {
    label: "MANIPULATED",
    icon: ShieldAlert,
    classes: "bg-fake-subtle text-fake border-fake",
    pulseClass: "",
  },
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-xs gap-1",
  md: "px-3 py-1 text-sm gap-1.5",
  lg: "px-4 py-2 text-base gap-2",
};

const iconSizes = {
  sm: 12,
  md: 14,
  lg: 18,
};

export function VerdictBadge({
  verdict,
  size = "md",
  showPulse = true,
  className,
}: VerdictBadgeProps) {
  const config = verdictConfig[verdict];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border font-mono font-semibold tracking-widest",
        "transition-smooth",
        sizeClasses[size],
        config.classes,
        showPulse && verdict === Verdict.Real && config.pulseClass,
        className,
      )}
      data-ocid="verdict-badge"
    >
      <Icon size={iconSizes[size]} strokeWidth={2.5} />
      {config.label}
    </span>
  );
}

// ─── Verdict Hero Banner ──────────────────────────────────────────────────────

interface VerdictHeroBannerProps {
  verdict: Verdict;
  overallScore: number;
}

const heroBannerConfig = {
  [Verdict.Real]: {
    label: "VERDICT: AUTHENTIC",
    subtitle: "High confidence — No manipulation detected",
    icon: Shield,
    colorVar: "var(--verdict-real)",
    glowClass: "glow-real",
    borderClass: "border-real",
    bgClass: "bg-real-subtle",
    textClass: "text-real",
    scanColor: "oklch(var(--verdict-real) / 0.15)",
    pulseClass: "pulse-neon",
  },
  [Verdict.Uncertain]: {
    label: "VERDICT: UNCERTAIN",
    subtitle: "Medium confidence — Inconclusive analysis",
    icon: ShieldQuestion,
    colorVar: "var(--verdict-uncertain)",
    glowClass: "",
    borderClass: "border-uncertain",
    bgClass: "bg-uncertain-subtle",
    textClass: "text-uncertain",
    scanColor: "oklch(var(--verdict-uncertain) / 0.12)",
    pulseClass: "",
  },
  [Verdict.Fake]: {
    label: "VERDICT: MANIPULATED",
    subtitle: "High confidence — Manipulation signatures detected",
    icon: ShieldAlert,
    colorVar: "var(--verdict-fake)",
    glowClass: "glow-fake",
    borderClass: "border-fake",
    bgClass: "bg-fake-subtle",
    textClass: "text-fake",
    scanColor: "oklch(var(--verdict-fake) / 0.15)",
    pulseClass: "",
  },
};

export function VerdictHeroBanner({
  verdict,
  overallScore,
}: VerdictHeroBannerProps) {
  const cfg = heroBannerConfig[verdict];
  const Icon = cfg.icon;
  const confidence =
    verdict === Verdict.Fake
      ? overallScore
      : verdict === Verdict.Real
        ? 100 - overallScore
        : 50;

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-xl border-2 p-8",
        cfg.borderClass,
        cfg.bgClass,
        cfg.glowClass,
      )}
      initial={{ opacity: 0, y: -24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      data-ocid="verdict-hero-banner"
    >
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            ${cfg.scanColor} 3px,
            ${cfg.scanColor} 4px
          )`,
        }}
      />

      {/* Animated horizontal scan beam */}
      <motion.div
        className="absolute left-0 right-0 h-px pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, oklch(${cfg.colorVar} / 0.8), transparent)`,
          boxShadow: `0 0 8px oklch(${cfg.colorVar} / 0.6)`,
        }}
        initial={{ top: "10%" }}
        animate={{ top: "90%" }}
        transition={{
          duration: 2.5,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
          delay: 0.6,
        }}
      />

      {/* Forensic grid background */}
      <div className="absolute inset-0 grid-forensic opacity-20 pointer-events-none" />

      {/* Content */}
      <div className="relative flex flex-col lg:flex-row items-center gap-8 text-center lg:text-left">
        {/* Icon block */}
        <motion.div
          className={cn(
            "w-24 h-24 rounded-2xl border-2 flex items-center justify-center shrink-0",
            cfg.borderClass,
            cfg.bgClass,
          )}
          initial={{ scale: 0.5, rotate: -15, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <Icon
            size={48}
            strokeWidth={1.5}
            className={cn(
              cfg.textClass,
              verdict === Verdict.Real ? cfg.pulseClass : "",
            )}
          />
        </motion.div>

        {/* Text block */}
        <div className="flex-1 min-w-0 space-y-4">
          <motion.div
            className="font-mono text-xs tracking-[0.4em] text-muted-foreground uppercase mb-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Forensic Analysis Result
          </motion.div>

          <motion.h2
            className={cn(
              "font-display font-black tracking-tight leading-none",
              "text-4xl sm:text-5xl lg:text-6xl",
              cfg.textClass,
              verdict === Verdict.Fake && "animate-flicker",
            )}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.25,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {cfg.label}
          </motion.h2>

          <motion.p
            className="font-mono text-base text-muted-foreground font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            {cfg.subtitle}
          </motion.p>
        </div>

        {/* Confidence block */}
        <motion.div
          className={cn(
            "flex flex-col items-center gap-2 px-8 py-6 rounded-xl border shrink-0 min-w-[140px]",
            cfg.borderClass,
            cfg.bgClass,
          )}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            Confidence
          </span>
          <span
            className={cn(
              "font-display font-black text-5xl tabular-nums",
              cfg.textClass,
            )}
          >
            {confidence}%
          </span>
          <div className="text-center space-y-1">
            <span className="font-mono text-xs text-muted-foreground block">
              Risk Score
            </span>
            <span className="font-mono text-sm font-semibold text-foreground block">
              {overallScore}/100
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
