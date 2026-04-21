import hashlib
import random

from .models import FlaggedFrame, ForensicBreakdown, FrameAnalysis, Verdict


def _seed_from_file(filename: str, file_size: int) -> int:
    seed_text = f"{filename}:{file_size}"
    digest = hashlib.sha256(seed_text.encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


def simulate_analysis(filename: str, file_size: int) -> tuple[float, Verdict, ForensicBreakdown, FrameAnalysis]:
    rng = random.Random(_seed_from_file(filename, file_size))

    deepfake_probability = rng.uniform(0.0, 1.0)
    frame_insertion_risk = rng.uniform(0.0, 0.5)
    frame_deletion_risk = rng.uniform(0.0, 0.4)
    temporal_inconsistency = rng.uniform(0.0, 0.8)
    compression_artifacts = rng.uniform(0.1, 0.9)
    audio_video_sync = rng.uniform(0.5, 1.0)

    raw_score = (
        (1.0 - deepfake_probability) * 0.40
        + (1.0 - frame_insertion_risk) * 0.15
        + (1.0 - frame_deletion_risk) * 0.15
        + (1.0 - temporal_inconsistency) * 0.15
        + (1.0 - compression_artifacts) * 0.05
        + audio_video_sync * 0.10
    )
    overall_score = raw_score * 100.0

    if overall_score >= 70.0:
        verdict = Verdict.Real
    elif overall_score >= 40.0:
        verdict = Verdict.Uncertain
    else:
        verdict = Verdict.Fake

    frame_count = max(1, file_size // 51200)
    color_anomaly_score = rng.uniform(0.1, 0.6)
    flagged_count = rng.randint(3, 8)

    flagged_frames: list[FlaggedFrame] = []
    for _ in range(flagged_count):
        flagged_frames.append(
            FlaggedFrame(
                frameIndex=rng.randint(0, max(0, frame_count - 1)),
                suspicionScore=rng.uniform(0.3, 0.95),
            )
        )

    forensic = ForensicBreakdown(
        deepfakeProbability=deepfake_probability,
        frameInsertionRisk=frame_insertion_risk,
        frameDeletionRisk=frame_deletion_risk,
        temporalInconsistencyScore=temporal_inconsistency,
        compressionArtifactScore=compression_artifacts,
        audioVideoSyncScore=audio_video_sync,
    )

    frame_analysis = FrameAnalysis(
        frameCount=frame_count,
        flaggedFrames=flagged_frames,
        resolution="1920x1080",
        frameRate=29.97,
        colorAnomalyScore=color_anomaly_score,
    )

    return overall_score, verdict, forensic, frame_analysis
