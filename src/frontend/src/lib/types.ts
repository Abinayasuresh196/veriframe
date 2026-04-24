import type { Principal } from "@icp-sdk/core/principal";

export type AnalysisId = string;
export type ShareToken = string;
export type UserId = Principal;
export type Timestamp = bigint;

export enum AnalysisStatus {
  Queued = "Queued",
  Processing = "Processing",
  Complete = "Complete",
  Failed = "Failed",
}

export enum Verdict {
  Real = "Real",
  Uncertain = "Uncertain",
  Fake = "Fake",
}

export interface FlaggedFrame {
  frameIndex: bigint;
  suspicionScore: number;
  label?: string;
  extractedFrame?: string;
}

export interface FaceTrackingPoint {
  frame: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FrameAnalysis {
  frameCount: bigint;
  flaggedFrames: FlaggedFrame[];
  faceTrackingData?: FaceTrackingPoint[];
  resolution: string;
  frameRate: number;
  colorAnomalyScore: number;
}

export interface ForensicBreakdown {
  deepfakeProbability: number;
  frameInsertionRisk: number;
  frameDeletionRisk: number;
  temporalInconsistencyScore: number;
  compressionArtifactScore: number;
  audioVideoSyncScore: number;
}

export interface AnalysisRecord {
  id: AnalysisId;
  filename: string;
  fileSize: bigint;
  uploadTimestamp: Timestamp;
  status: AnalysisStatus;
  overallScore: number;
  verdict: Verdict;
  forensic: ForensicBreakdown;
  frameAnalysis: FrameAnalysis;
  videoUrl?: string;
}

export interface SubmitVideoMetadata {
  frameCount?: bigint;
  frameRate?: number;
  resolution?: string;
}

export type HistoryFilter = "all" | "real" | "uncertain" | "fake";
