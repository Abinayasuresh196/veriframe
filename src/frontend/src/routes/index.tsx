import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Gavel,
  Microscope,
  Newspaper,
  Shield,
  Upload,
  Wand2,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";

export const Route = undefined;

/* ─────────────────────────────────────── DATA ── */

const features = [
  {
    icon: Zap,
    title: "Real-Time Detection",
    description:
      "Submit video URLs for instant queue processing with live status updates and millisecond-level frame timestamps.",
  },
  {
    icon: Eye,
    title: "Frame Heatmaps",
    description:
      "Attention-weighted heatmaps overlay suspicious regions frame-by-frame, highlighting compression artifacts and pixel-level inconsistencies.",
  },
  {
    icon: BarChart3,
    title: "Temporal Analysis",
    description:
      "Bidirectional RNN modeling captures motion discontinuities, optical-flow breaks, and inter-frame encoding anomalies.",
  },
  {
    icon: FileText,
    title: "Forensic Reports",
    description:
      "Exportable forensic reports with chain-of-custody metadata, suitable for legal and journalistic documentation.",
  },
];

const trustCases = [
  {
    icon: Newspaper,
    role: "Journalism",
    description:
      "Verify leaked footage before publishing. Attach tamper evidence reports directly to editorial submissions.",
  },
  {
    icon: Gavel,
    role: "Law Enforcement",
    description:
      "Flag deepfake artifacts in digital evidence before court submission. Immutable on-chain audit trail.",
  },
  {
    icon: Microscope,
    role: "Research",
    description:
      "Batch analyze media datasets. Export multi-signal forensic breakdowns for academic peer review.",
  },
];

const steps = [
  {
    step: "01",
    icon: Upload,
    title: "Upload Video",
    description: "Submit a video file or URL via the secure analysis portal.",
  },
  {
    step: "02",
    icon: Eye,
    title: "CNN Frame Extraction",
    description:
      "Convolutional neural net extracts spatial features from every frame.",
  },
  {
    step: "03",
    icon: BarChart3,
    title: "RNN Temporal Analysis",
    description:
      "Recurrent network models dependencies across the full video sequence.",
  },
  {
    step: "04",
    icon: Wand2,
    title: "Attention Scoring",
    description: "Attention mechanism pinpoints localized tampering artifacts.",
  },
  {
    step: "05",
    icon: FileText,
    title: "Forensic Report",
    description:
      "Composite confidence score, frame heatmaps, and exportable evidence report.",
  },
];

const rawStats = [
  { target: 99.2, suffix: "%", label: "Detection Accuracy", decimal: 1 },
  { target: 3, prefix: "<", suffix: "s", label: "Analysis Time", decimal: 0 },
  { target: 12, suffix: "", label: "Manipulation Types", decimal: 0 },
];

const faqs = [
  {
    q: "What video formats does VeriFrame support?",
    a: "VeriFrame accepts MP4, MOV, AVI, MKV, and WebM files up to 2GB. For larger files, use a direct URL to hosted content.",
  },
  {
    q: "How long does analysis take?",
    a: "Most videos complete within 3 seconds for standard resolution. 4K or long-form content may take up to 30 seconds depending on queue load.",
  },
  {
    q: "Is my video stored or shared?",
    a: "Metadata and analysis results are stored on-chain linked to your decentralized identity. Raw video bytes are never retained — only frame-level feature vectors.",
  },
  {
    q: "How accurate is the detection?",
    a: "Our CNN+RNN pipeline with attention mechanism achieves 99.2% accuracy on standard benchmark datasets including FaceForensics++ and DFDC. Real-world performance varies based on compression quality and manipulation sophistication.",
  },
  {
    q: "How should I interpret the confidence score?",
    a: "Scores 0–30 indicate authentic content. 31–70 indicate uncertain — further manual review is recommended. 71–100 indicate high probability of manipulation. Always treat results as forensic evidence, not final verdicts.",
  },
  {
    q: "Can VeriFrame results be used in legal contexts?",
    a: "Results are not a substitute for certified forensic analysis. However, the immutable on-chain audit trail, chain-of-custody metadata, and exportable reports can support legal proceedings as supplementary evidence.",
  },
];

/* ─────────────────────────────────────── HOOKS ── */

function useInView(ref: React.RefObject<Element | null>, threshold = 0.15) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return inView;
}

function useCounter(target: number, decimal: number, active: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    const duration = 1800;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      setVal(+(eased * target).toFixed(decimal));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, decimal]);
  return val;
}

/* ─────────────────────────────────────── COMPONENTS ── */

function StatCounter({
  target,
  prefix = "",
  suffix,
  label,
  decimal,
}: {
  target: number;
  prefix?: string;
  suffix: string;
  label: string;
  decimal: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const val = useCounter(target, decimal, inView);
  return (
    <div ref={ref} className="text-center reveal-item" data-ocid="stat-counter">
      <div className="font-mono font-bold text-4xl md:text-5xl text-primary mb-2 tabular-nums">
        {prefix}
        {val.toFixed(decimal)}
        {suffix}
      </div>
      <div className="text-xs text-muted-foreground uppercase tracking-widest font-mono">
        {label}
      </div>
    </div>
  );
}

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  return (
    <div
      className="border border-border rounded-lg overflow-hidden transition-smooth"
      style={{ animationDelay: `${index * 0.07}s` }}
      data-ocid={`faq-item-${index}`}
    >
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4 hover:bg-muted/30 transition-smooth focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        aria-expanded={open}
      >
        <span className="font-medium text-sm text-foreground">{q}</span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? "max-h-40" : "max-h-0"}`}
      >
        <p className="px-5 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed">
          {a}
        </p>
      </div>
    </div>
  );
}

function RevealSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, 0.1);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────── PAGE ── */

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex flex-col">
      {/* ── HERO ── */}
      <section
        className="relative h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden"
        aria-label="Hero section"
      >
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage:
              "url('/assets/images/home.png')",
          }}
          aria-hidden="true"
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-background/80" aria-hidden="true" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 grid-forensic opacity-60"
          aria-hidden="true"
        />

        {/* Scan line */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
        >
          <div className="absolute left-0 right-0 h-px bg-primary/40 animate-scan shadow-[0_0_8px_2px_oklch(var(--primary)/0.3)]" />
        </div>

        {/* Corner brackets */}
        <div
          className="pointer-events-none absolute inset-8 hidden lg:block"
          aria-hidden="true"
        >
          <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-primary/40" />
          <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-primary/40" />
          <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-primary/40" />
          <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-primary/40" />
        </div>

        <div className="container mx-auto px-4 py-12 text-center relative z-10 max-w-5xl flex flex-col items-center justify-center h-full">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 font-mono text-xs text-primary bg-primary/10 border border-primary/30 px-4 py-2 rounded-full mb-8"
            style={{ animation: "fade-up 0.6s ease forwards" }}
          >
            <span
              className="w-2 h-2 rounded-full bg-primary pulse-neon"
              aria-hidden="true"
            />
            CNN · RNN · ATTENTION MECHANISM · FORENSIC AI v2.0
          </div>

          {/* Headline */}
          <h1
            className="text-5xl sm:text-6xl lg:text-8xl font-display font-bold tracking-tight mb-6 leading-[1.05]"
            style={{ animation: "fade-up 0.7s ease 0.1s both" }}
          >
            <span className="text-foreground">Detect Manipulated</span>
            <br />
            <span className="text-primary animate-flicker">Videos with AI</span>
            <br />
            <span className="text-foreground">Forensics</span>
          </h1>

          {/* Subheadline */}
          <p
            className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed"
            style={{ animation: "fade-up 0.7s ease 0.2s both" }}
          >
            VeriFrame combines{" "}
            <span className="text-foreground font-medium">
              CNN spatial analysis
            </span>
            ,{" "}
            <span className="text-foreground font-medium">
              RNN temporal modeling
            </span>
            , and an{" "}
            <span className="text-foreground font-medium">
              attention mechanism
            </span>{" "}
            to detect deepfakes, frame insertion, deletion, and compression
            artifacts — delivering a forensic verdict in seconds.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            style={{ animation: "fade-up 0.7s ease 0.3s both" }}
          >
            {isAuthenticated ? (
              <Button
                asChild
                size="lg"
                className="gap-2 glow-primary font-mono"
                data-ocid="hero-cta-upload"
              >
                <Link to="/upload">
                  <Upload size={18} aria-hidden="true" />
                  Analyze a Video
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Link to="/login">
                <Button
                  size="lg"
                  className="gap-2 glow-primary font-mono"
                  data-ocid="hero-cta-login"
                >
                  <Shield size={18} aria-hidden="true" />
                  Analyze a Video
                  <ChevronRight size={16} aria-hidden="true" />
                </Button>
              </Link>
            )}
            <Button
              asChild
              variant="outline"
              size="lg"
              className="gap-2 font-mono border-border/60 hover:border-primary/50"
              data-ocid="hero-cta-learn"
            >
              <a href="#how-it-works">
                See How It Works
                <ChevronDown size={16} aria-hidden="true" />
              </a>
            </Button>
          </div>

          {/* Scroll hint */}
          <div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground/50"
            aria-hidden="true"
            style={{ animation: "fade-in 1s ease 1s both" }}
          >
            <span className="font-mono text-[10px] uppercase tracking-widest">
              Scroll
            </span>
            <div className="w-px h-8 bg-gradient-to-b from-primary/40 to-transparent" />
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ── */}
      <section
        className="bg-card border-y border-border py-20"
        aria-labelledby="trust-heading"
      >
        <div className="container mx-auto px-4">
          <RevealSection className="text-center mb-14">
            <span className="font-mono text-xs text-primary uppercase tracking-widest mb-3 block">
              Trusted By
            </span>
            <h2
              id="trust-heading"
              className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-3"
            >
              Built for High-Stakes Verification
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              VeriFrame is purpose-built for the professionals whose decisions
              depend on video authenticity.
            </p>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {trustCases.map((tc, i) => (
              <RevealSection key={tc.role} delay={i * 0.12}>
                <Card
                  className="p-6 bg-background border-border hover:border-primary/40 transition-smooth h-full group"
                  data-ocid={`trust-card-${tc.role.toLowerCase()}`}
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-smooth">
                    <tc.icon
                      size={22}
                      className="text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="font-mono font-bold text-foreground mb-2">
                    {tc.role}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {tc.description}
                  </p>
                </Card>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section
        id="features"
        className="bg-background py-24"
        aria-labelledby="features-heading"
      >
        <div className="container mx-auto px-4">
          <RevealSection className="text-center mb-16">
            <span className="font-mono text-xs text-primary uppercase tracking-widest mb-3 block">
              Capabilities
            </span>
            <h2
              id="features-heading"
              className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4"
            >
              Forensic-Grade Detection
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Every analysis produces a multi-dimensional forensic breakdown —
              not just a verdict.
            </p>
          </RevealSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, i) => (
              <RevealSection key={feature.title} delay={i * 0.1}>
                <Card
                  className="p-6 bg-card border-border hover:border-primary/50 transition-smooth h-full group hover:shadow-[0_0_30px_oklch(var(--primary)/0.15),0_0_60px_oklch(var(--primary)/0.07)] cursor-default"
                  data-ocid={`feature-card-${i}`}
                >
                  <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 group-hover:bg-primary/20 group-hover:border-primary/40 transition-smooth">
                    <feature.icon
                      size={20}
                      className="text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section
        id="how-it-works"
        className="bg-muted/20 border-y border-border py-24"
        aria-labelledby="how-heading"
      >
        <div className="container mx-auto px-4">
          <RevealSection className="text-center mb-16">
            <span className="font-mono text-xs text-primary uppercase tracking-widest mb-3 block">
              Process
            </span>
            <h2
              id="how-heading"
              className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4"
            >
              How It Works
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Five-stage forensic pipeline from raw video to evidence-grade
              verdict.
            </p>
          </RevealSection>

          {/* Steps: horizontal on lg, vertical on mobile */}
          <div className="relative max-w-6xl mx-auto">
            {/* Connecting line — desktop */}
            <div
              className="hidden lg:block absolute top-[2.6rem] left-[calc(10%+2rem)] right-[calc(10%+2rem)] h-px"
              aria-hidden="true"
              style={{
                background:
                  "linear-gradient(90deg, transparent, oklch(var(--primary)/0.4) 20%, oklch(var(--primary)/0.4) 80%, transparent)",
              }}
            />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-2">
              {steps.map((step, i) => (
                <RevealSection
                  key={step.step}
                  delay={i * 0.1}
                  className="flex flex-col items-center text-center lg:px-2"
                >
                  {/* Mobile connector line */}
                  {i < steps.length - 1 && (
                    <div
                      className="lg:hidden w-px h-6 bg-gradient-to-b from-primary/40 to-transparent mt-2 mb-2"
                      aria-hidden="true"
                    />
                  )}

                  {/* Icon */}
                  <div className="relative mb-4 z-10">
                    <div className="w-20 h-20 rounded-full border-2 border-primary/40 bg-card flex items-center justify-center group hover:border-primary transition-smooth hover:shadow-[0_0_20px_oklch(var(--primary)/0.3)]">
                      <step.icon
                        size={26}
                        className="text-primary"
                        aria-hidden="true"
                      />
                    </div>
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground font-mono text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>

                  <h3 className="font-mono font-bold text-sm text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </RevealSection>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-background py-24" aria-labelledby="stats-heading">
        <div className="container mx-auto px-4">
          <RevealSection className="text-center mb-16">
            <span className="font-mono text-xs text-primary uppercase tracking-widest mb-3 block">
              Performance
            </span>
            <h2
              id="stats-heading"
              className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4"
            >
              Precision at Scale
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Benchmarked against industry-standard deepfake detection datasets.
            </p>
          </RevealSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-3xl mx-auto">
            {rawStats.map((stat) => (
              <StatCounter key={stat.label} {...stat} />
            ))}
          </div>

          {/* Additional stat badges */}
          <RevealSection
            delay={0.3}
            className="mt-12 flex flex-wrap justify-center gap-3"
          >
            {[
              { label: "FaceForensics++", value: "99.1%" },
              { label: "DFDC Benchmark", value: "98.7%" },
              { label: "Celeb-DF", value: "99.4%" },
              { label: "WildDeepfake", value: "97.8%" },
            ].map((b) => (
              <div
                key={b.label}
                className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2"
              >
                <CheckCircle2
                  size={14}
                  className="text-real"
                  aria-hidden="true"
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {b.label}
                </span>
                <span className="font-mono text-xs font-bold text-primary">
                  {b.value}
                </span>
              </div>
            ))}
          </RevealSection>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section
        id="faq"
        className="bg-card border-y border-border py-24"
        aria-labelledby="faq-heading"
      >
        <div className="container mx-auto px-4 max-w-5xl">
          <RevealSection className="text-center mb-14">
            <span className="font-mono text-xs text-primary uppercase tracking-widest mb-3 block">
              FAQ
            </span>
            <h2
              id="faq-heading"
              className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-4"
            >
              Common Questions
            </h2>
            <p className="text-muted-foreground">
              Everything you need to know before submitting your first analysis.
            </p>
          </RevealSection>

          <ul
            className="grid grid-cols-1 md:grid-cols-2 gap-4 list-none p-0 m-0"
            aria-label="Frequently asked questions"
          >
            {faqs.map((faq, i) => (
              <li key={faq.q} className="list-none h-full">
                <FaqItem q={faq.q} a={faq.a} index={i} />
              </li>
            ))}
          </ul>

          <RevealSection delay={0.2} className="text-center mt-12">
            <p className="text-sm text-muted-foreground mb-4">
              Still have questions? Explore the documentation or start your
              first analysis.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                variant="outline"
                className="gap-2 font-mono"
                asChild
                data-ocid="faq-docs-btn"
              >
                <a href="#features">
                  <BookOpen size={16} aria-hidden="true" />
                  View Capabilities
                </a>
              </Button>
              {isAuthenticated ? (
                <Button
                  asChild
                  className="gap-2 glow-primary font-mono"
                  data-ocid="faq-cta-upload"
                >
                  <Link to="/upload">
                    <Upload size={16} aria-hidden="true" />
                    Analyze a Video
                  </Link>
                </Button>
              ) : (
                <Link to="/login">
                  <Button
                    className="gap-2 glow-primary font-mono"
                    data-ocid="faq-cta-login"
                  >
                    <Shield size={16} aria-hidden="true" />
                    Get Started Free
                  </Button>
                </Link>
              )}
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section
        className="bg-background py-28 relative overflow-hidden"
        aria-label="Call to action"
      >
        <div
          className="absolute inset-0 grid-forensic opacity-30"
          aria-hidden="true"
        />
        <div className="relative z-10 container mx-auto px-4 text-center">
          <RevealSection>
            <span className="font-mono text-xs text-primary uppercase tracking-widest mb-4 block">
              Ready to Verify?
            </span>
            <h2 className="text-4xl sm:text-5xl font-display font-bold text-foreground mb-5">
              Authenticate Any Video
              <br />
              <span className="text-primary">in Seconds</span>
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-10">
              Sign in with Internet Identity and submit your first video for
              forensic analysis — no setup required.
            </p>
            {isAuthenticated ? (
              <Button
                asChild
                size="lg"
                className="gap-2 glow-primary font-mono"
                data-ocid="final-cta-upload"
              >
                <Link to="/upload">
                  <Upload size={18} aria-hidden="true" />
                  Analyze a Video
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Link to="/login">
                <Button
                  size="lg"
                  className="gap-2 glow-primary font-mono"
                  data-ocid="final-cta-login"
                >
                  <Shield size={18} aria-hidden="true" />
                  Start Analysis
                  <ChevronRight size={16} aria-hidden="true" />
                </Button>
              </Link>
            )}
          </RevealSection>
        </div>
      </section>
    </div>
  );
}
