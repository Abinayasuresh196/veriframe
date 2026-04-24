from enum import Enum
from typing import Optional
from pydantic import BaseModel


class AnalysisStatus(str, Enum):
    Queued = "Queued"
    Processing = "Processing"
    Complete = "Complete"
    Failed = "Failed"


class Verdict(str, Enum):
    Real = "Real"
    Uncertain = "Uncertain"
    Fake = "Fake"
    Unknown = "Unknown"


class FlaggedFrame(BaseModel):
    frameIndex: int
    suspicionScore: float
    label: str = "Uncertain"
    extractedFrame: str | None = None


class FrameAnalysis(BaseModel):
    frameCount: int = 0
    flaggedFrames: list[FlaggedFrame] = []
    resolution: str = ""
    frameRate: float = 0.0
    colorAnomalyScore: float = 0.0
    faceTrackingData: list = []


class ForensicBreakdown(BaseModel):
    deepfakeProbability: float
    frameInsertionRisk: float
    frameDeletionRisk: float
    temporalInconsistencyScore: float
    compressionArtifactScore: float
    audioVideoSyncScore: float


class AnalysisRecord(BaseModel):
    id: str
    filename: str
    fileSize: int
    uploadTimestamp: int
    status: AnalysisStatus
    overallScore: float
    verdict: Verdict
    forensic: ForensicBreakdown
    frameAnalysis: FrameAnalysis
    videoUrl: str | None = None
    extractedFrames: dict[int, str] = {}


class SubmitVideoMetadata(BaseModel):
    frameCount: int | None = None
    frameRate: float | None = None
    resolution: str | None = None


class SubmitVideoRequest(BaseModel):
    filename: str
    fileSize: int
    metadata: SubmitVideoMetadata = SubmitVideoMetadata()


class GenerateShareTokenRequest(BaseModel):
    pass


class DeleteAnalysisRequest(BaseModel):
    pass
