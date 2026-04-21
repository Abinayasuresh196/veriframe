from enum import Enum
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


class FlaggedFrame(BaseModel):
    frameIndex: int
    suspicionScore: float
    extractedFrame: str | None = None


class FrameAnalysis(BaseModel):
    frameCount: int
    flaggedFrames: list[FlaggedFrame]
    resolution: str
    frameRate: float
    colorAnomalyScore: float


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
