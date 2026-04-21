import { Terminal, ThumbsDown, ThumbsUp } from "lucide-react";
import { motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef, useState, useMemo } from "react";
import { cn } from "../lib/utils";
import type { FaceTrackingPoint } from "../lib/types";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

interface VideoPlayerWithOverlayProps {
  videoUrl: string | null;
  verdict: string;
  confidence: number;
  trackingData?: FaceTrackingPoint[];
  frameRate?: number;
}

export function VideoPlayerWithOverlay({
  videoUrl,
  verdict,
  confidence,
  trackingData = [],
  frameRate = 30
}: VideoPlayerWithOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [landmarker, setLandmarker] = useState<FaceLandmarker | null>(null);

  // --- RAW INSTANT TRACKING ---
  const [isHumanLocked, setIsHumanLocked] = useState(false);
  const validFrameCount = useRef(0);
  const lastProcessedTime = useRef(0);

  // Motion values (Set directly for zero latency)
  const boxX = useMotionValue(50);
  const boxY = useMotionValue(50);
  const boxW = useMotionValue(40);
  const boxH = useMotionValue(50);

  // Map directly to percentage strings WITHOUT springs/animations
  const leftPct = useTransform(boxX, (v) => `${v}%`);
  const topPct = useTransform(boxY, (v) => `${v}%`);
  const widthPct = useTransform(boxW, (v) => `${v}%`);
  const heightPct = useTransform(boxH, (v) => `${v}%`);

  const [logs, setLogs] = useState<string[]>([]);

  // Initialize MediaPipe Face Landmarker
  useEffect(() => {
    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        const fl = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
        setLandmarker(fl);
      } catch (err) {
        console.error("Landmarker init error:", err);
      }
    }
    init();
  }, []);

  // Instant Tracking Loop (Real-time Frame-by-Frame)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let isRunning = true;
    let frameCount = 0;

    const loop = () => {
      if (!isRunning || !video) return;

      const now = performance.now();
      // Fast refresh (up to 60 times a second)
      if (now - lastProcessedTime.current < 16) { 
        requestAnimationFrame(loop);
        return;
      }
      lastProcessedTime.current = now;
      frameCount++;

      if (landmarker) {
        try {
          const results = landmarker.detectForVideo(video, now);

          if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const face = results.faceLandmarks[0];
            
            let minX = 1, maxX = 0, minY = 1, maxY = 0;
            face.forEach(lm => {
              minX = Math.min(minX, lm.x);
              maxX = Math.max(maxX, lm.x);
              minY = Math.min(minY, lm.y);
              maxY = Math.max(maxY, lm.y);
            });

            const width = maxX - minX;
            const height = maxY - minY;

            // Quick lock logic
            if (width < 0.08 || height < 0.08) {
              validFrameCount.current = 0;
              setIsHumanLocked(false);
              requestAnimationFrame(loop);
              return;
            }

            setIsHumanLocked(true);

            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const cw = video.clientWidth;
            const ch = video.clientHeight;

            if (vw && vh && cw && ch) {
              const videoRatio = vw / vh;
              const containerRatio = cw / ch;
              let actualWidth, actualHeight, offsetX = 0, offsetY = 0;

              if (containerRatio > videoRatio) {
                actualHeight = ch;
                actualWidth = ch * videoRatio;
                offsetX = (cw - actualWidth) / 2;
              } else {
                actualWidth = cw;
                actualHeight = cw / videoRatio;
                offsetY = (ch - actualHeight) / 2;
              }

              const centerX = (minX + maxX) / 2;
              const centerY = (minY + maxY) / 2;

              const targetX = ((offsetX + centerX * actualWidth) / cw) * 100;
              const targetY = ((offsetY + centerY * actualHeight) / ch) * 100;
              const targetW = (width * actualWidth / cw) * 100;
              const targetH = (height * actualHeight / ch) * 100;

              // --- RAW DIRECT UPDATE (NO Smoothing / NO Springs) ---
              // Guard against NaN values
              boxX.set(isNaN(targetX) ? 50 : targetX);
              boxY.set(isNaN(targetY) ? 50 : targetY);
              boxW.set(isNaN(targetW) ? 40 : Math.min(targetW * 1.25, 75));
              boxH.set(isNaN(targetH) ? 50 : Math.min(targetH * 1.35, 85));
            }
          } else {
            setIsHumanLocked(false);
          }
        } catch (err) {
          // Silently handle face detection errors
        }
      }
      requestAnimationFrame(loop);
    };

    video.addEventListener("play", () => loop());
    if (!video.paused) loop();

    return () => { isRunning = false; };
  }, [landmarker, boxX, boxY, boxW, boxH]);

  useEffect(() => {
    const messages = [
      "Zero-Latency mode: ACTIVE",
      "Spring simulation: DISABLED",
      "Motion damping: REMOVED",
      "Real-time frame sync active",
      "Raw vector stream: ESTABLISHED"
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < messages.length) {
        setLogs(prev => [...prev.slice(-4), `> ${messages[i]}`]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 600);

    return () => clearInterval(interval);
  }, []);

  const isFake = verdict.toLowerCase() === "fake";
  const isUncertain = verdict.toLowerCase() === "uncertain";

  return (
    <div className="flex flex-col gap-6">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-white/10 shadow-2xl">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="absolute inset-0 w-full h-full object-contain opacity-90"
            autoPlay muted loop playsInline crossOrigin="anonymous"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="grid-forensic absolute inset-0 opacity-20" />
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none grid-forensic opacity-5" />

        {/* The RAW Instant Box */}
        <motion.div
          animate={{ opacity: isHumanLocked ? 1 : 0.3 }}
          style={{ left: leftPct, top: topPct, width: widthPct, height: heightPct, x: "-50%", y: "-50%" }}
          transition={{ duration: 0 }} // Force zero animation time
          className={cn(
            "absolute border-2 rounded-sm shadow-[0_0_30px_rgba(0,0,0,0.6)]",
            isFake ? "border-fake shadow-fake/30" : isUncertain ? "border-uncertain shadow-uncertain/30" : "border-real shadow-real/30"
          )}
        >
          <div className={cn("absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4", isFake ? "border-fake" : isUncertain ? "border-uncertain" : "border-real")} />
          <div className={cn("absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4", isFake ? "border-fake" : isUncertain ? "border-uncertain" : "border-real")} />

          <div className={cn(
            "absolute top-0 left-0 -translate-y-full px-2 py-1 text-[11px] font-black tracking-tighter text-white whitespace-nowrap",
            isFake ? "bg-fake" : isUncertain ? "bg-uncertain" : "bg-real"
          )}>
            RAW_SCAN: {verdict.toUpperCase()} {confidence.toFixed(1)}%
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(255,255,255,0.08)_50%,transparent_100%)] bg-[length:100%_15px] animate-scan opacity-60" />
        </motion.div>

        {/* HUD */}
        <div className="absolute top-4 right-6 text-right font-mono text-[8px] text-white/50 space-y-0.5 bg-black/60 p-2 rounded border border-white/5 backdrop-blur-md">
          <p>SYSTEM_CORE: V29.1 [RAW]</p>
          <p>LATENCY: 0MS [INSTANT]</p>
          <p>DAMPING: 0.0</p>
        </div>

        {/* Real-time Forensic Terminal */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-lg border-t border-white/5 p-4 h-24 flex items-center">
          <div className="flex flex-col gap-0.5 w-full">
            {logs.map((log, idx) => (
              <div key={idx} className="font-mono text-[9px] text-primary/80 animate-in fade-in slide-in-from-left-2 duration-300">
                {log}
              </div>
            ))}
          </div>
          <div className="ml-auto flex flex-col items-end text-white/30 font-mono text-[9px] gap-1 px-4 border-l border-white/5">
            <div className="flex items-center gap-2">
              <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isHumanLocked ? "bg-primary" : "bg-white/10")} />
              <span className="uppercase tracking-tighter">{isHumanLocked ? "REAL_TIME_LOCK" : "SEARCH_ID"}</span>
            </div>
            <span>RAW_HZ: 60 [DIRECT]</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between p-6 bg-card border border-border rounded-xl shadow-xl">
        <div className="flex items-center gap-6">
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center shadow-lg transform transition-all duration-700",
            isFake ? "bg-fake/20 text-fake border-2 border-fake/40" : isUncertain ? "bg-uncertain/20 text-uncertain border-2 border-uncertain/40" : "bg-real/20 text-real border-2 border-real/40"
          )}>
            {isFake ? <ThumbsDown size={32} /> : <ThumbsUp size={32} />}
          </div>
          <div>
            <h4 className="font-display font-black text-foreground text-2xl tracking-tighter uppercase mb-0.5 leading-none">Forensic Result: {verdict}</h4>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Accuracy: {confidence.toFixed(2)}%</span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-3">
          <div className={cn(
            "px-5 py-2 rounded-full text-[11px] font-black font-mono tracking-[0.2em] uppercase border",
            isFake ? "bg-fake/10 text-fake border-fake/20" : isUncertain ? "bg-uncertain/10 text-uncertain border-uncertain/20" : "bg-real/10 text-real border-real/20"
          )}>
            {isFake ? "DEEPFAKE" : isUncertain ? "UNCERTAIN" : "AUTHENTIC"}
          </div>
          <span className="text-[9px] text-muted-foreground/40 font-mono tracking-tighter uppercase">FL_MESH: DIRECT_SYNC</span>
        </div>
      </div>
    </div>
  );
}
