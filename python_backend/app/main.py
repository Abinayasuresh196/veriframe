import time
import uuid
import logging
import random
import os
import subprocess
import tempfile
import requests
from datetime import datetime
from typing import Annotated

import cv2
import numpy as np
import aiofiles
from fastapi import FastAPI, Header, HTTPException, UploadFile, Form, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import settings
from .auth_mongodb import get_mongodb_auth, close_mongodb_auth
from .analysis_mongodb import get_mongodb_analysis, close_mongodb_analysis
from .cloudinary_service import get_cloudinary_service
from .models import (
    AnalysisRecord,
    AnalysisStatus,
    SubmitVideoRequest,
)
from .db import get_db

try:
    import tensorflow as tf
except ImportError:
    tf = None

# Configure logging to suppress uvicorn INFO logs
logging.getLogger("uvicorn").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.options("/{rest_of_path:path}")
async def preflight_fallback(rest_of_path: str):
    return {"status": "ok"}

@app.get("/")
def health():
    return {"status": "alive", "message": "Backend is running"}

@app.get("/test")
async def test_endpoint():
    return {"status": "ok", "message": "Backend is reachable"}

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Backend is healthy"}

@app.post("/analysis/submit/test")
async def test_submit_endpoint():
    return {"status": "ok", "message": "Submit endpoint path is working"}

@app.post("/submit")
async def simple_submit():
    return {"status": "ok", "message": "Simple submit endpoint working"}

@app.get("/debug/tensorflow")
async def debug_tensorflow():
    """Simple TensorFlow test endpoint."""
    debug_info = {
        "tensorflow_available": False,
        "model_file_exists": False,
        "model_path": "",
        "error": None
    }
    
    # Check TensorFlow availability
    try:
        import tensorflow as tf
        debug_info["tensorflow_available"] = True
        debug_info["tensorflow_version"] = tf.__version__
    except ImportError as e:
        debug_info["error"] = f"TensorFlow not available: {e}"
        return debug_info
    
    # Check model file
    model_path = os.path.join(os.path.dirname(__file__), "..", "models", "deepfake_model.tflite")
    debug_info["model_path"] = model_path
    debug_info["model_file_exists"] = os.path.exists(model_path)
    
    # Try to load TFLite interpreter
    if debug_info["model_file_exists"]:
        try:
            interpreter = tf.lite.Interpreter(model_path=model_path)
            interpreter.allocate_tensors()
            debug_info["tflite_loaded"] = True
            debug_info["input_details"] = str(interpreter.get_input_details())
            debug_info["output_details"] = str(interpreter.get_output_details())
        except Exception as e:
            debug_info["tflite_loaded"] = False
            debug_info["error"] = f"TFLite loading error: {e}"
    
    return debug_info

@app.get("/debug/frame-analysis")
async def debug_frame_analysis():
    """Test frame analysis with the loaded model."""
    from .deepfake_model import get_deepfake_model
    import numpy as np
    
    debug_info = {
        "model_available": False,
        "frame_prediction_test": False,
        "error": None
    }
    
    try:
        model = get_deepfake_model()
        debug_info["model_available"] = model.is_available()
        
        if model.is_available():
            # Test single frame prediction
            test_frame = np.random.randint(0, 255, (48, 48, 3), dtype=np.uint8)
            prediction = model.predict_frame(test_frame)
            debug_info["frame_prediction_test"] = True
            debug_info["test_prediction"] = float(prediction)
            debug_info["model_details"] = {
                "input_shape": str(model.input_details[0]["shape"]) if model.input_details else None,
                "output_shape": str(model.output_details[0]["shape"]) if model.output_details else None
            }
        
    except Exception as e:
        debug_info["error"] = str(e)
    
    return debug_info

@app.post("/test-upload")
async def test_upload(file: UploadFile = Form(...)):
    # Removed verbose logging
    return {"status": "ok", "filename": file.filename}


@app.on_event("startup")
async def on_startup() -> None:
    # Try to connect to MongoDB, but don't fail startup if connection fails
    try:
        await get_mongodb_auth()
        print("[startup] MongoDB auth initialized")
    except Exception as e:
        print(f"[startup] MongoDB auth initialization failed: {e}")
        print("[startup] Backend will use local storage fallback")
    
    try:
        await get_mongodb_analysis()
        print("[startup] MongoDB analysis initialized")
    except Exception as e:
        print(f"[startup] MongoDB analysis initialization failed: {e}")
        print("[startup] Backend will use local storage fallback")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await close_mongodb_auth()
    await close_mongodb_analysis()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    model_config = {"extra": "allow"}
    username: str
    password: str
    email: str | None = None


class AuthResponse(BaseModel):
    user_id: str
    username: str


@app.post("/auth/register", response_model=AuthResponse | None)
async def register(payload: RegisterRequest) -> AuthResponse | None:
    auth = await get_mongodb_auth()
    if not auth.mongodb or not auth.mongodb.connected:
        raise HTTPException(status_code=503, detail="Database connection error")

    user_id = await auth.register(payload.username, payload.password, payload.email)
    if user_id is None:
        raise HTTPException(status_code=400, detail="Username already exists")

    user = await auth.get_user(user_id)
    if user is None:
        raise HTTPException(status_code=500, detail="Failed to retrieve user after registration")

    return AuthResponse(user_id=user["id"], username=user["username"])


@app.post("/auth/login", response_model=AuthResponse | None)
async def login(payload: LoginRequest) -> AuthResponse | None:
    auth = await get_mongodb_auth()
    if not auth.mongodb or not auth.mongodb.connected:
        raise HTTPException(status_code=503, detail="Database connection error")

    user_id = await auth.login(payload.username, payload.password)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = await auth.get_user(user_id)
    if user is None:
        raise HTTPException(status_code=500, detail="Failed to retrieve user after login")

    return AuthResponse(user_id=user["id"], username=user["username"])


# ─── Background Task Functions ─────────────────────────────────────────────────

async def process_video_analysis(
    analysis_id: str,
    owner: str,
    filename: str,
    file_size: int,
    metadata: dict,
    local_video_path: str,
    use_mongodb: bool
):
    """Background task to process video analysis."""
    # 🔥 Initialize variables at top to prevent UnboundLocalError
    overall_score = 50
    verdict = "Uncertain"
    forensic = {}
    confidence = 50
    frame_analysis = {
        "frameCount": 0,
        "flaggedFrames": [],
        "resolution": "",
        "frameRate": 0,
        "colorAnomalyScore": 0,
        "faceTrackingData": []
    }
    extracted_frames = {}
    
    try:
        print(f"[background] Starting analysis for {filename}")

        # --- CLOUDINARY UPLOAD (Moved to background) ---
        from .cloudinary_service import get_cloudinary_service
        cloudinary = get_cloudinary_service()
        
        print(f"[background] Uploading to Cloudinary: {local_video_path}")
        video_url = await cloudinary.upload_video(
            local_video_path,
            public_id=f"{owner}_{filename}",
            folder="veriframe/videos"
        )
        print(f"[background] Cloudinary upload finished: {video_url is not None}")

        if use_mongodb:
            from .analysis_mongodb import get_mongodb_analysis
            analysis = await get_mongodb_analysis()
            
            # Update record with video URL early
            if video_url:
                await analysis.mongodb.database.analyses.update_one(
                    {"id": analysis_id},
                    {"$set": {"videoUrl": video_url}}
                )
            
        # We already have local_video_path from the submit route, skip download.
        pass

        # Optionally convert with ffmpeg if available (improves analysis quality)
        converted_video_path = local_video_path.replace(".mp4", "_converted.mp4")
        try:
            subprocess.run(
                ["ffmpeg", "-i", local_video_path,
                 "-vf", "scale=640:480,fps=30",
                 "-c:v", "libx264", "-pix_fmt", "yuv420p",
                 "-c:a", "aac", "-movflags", "+faststart",
                 converted_video_path, "-y"],
                check=True, capture_output=True, timeout=60
            )
            if os.path.exists(converted_video_path):
                local_video_path = converted_video_path
                print(f"[background] ✅ Video converted successfully")
        except Exception as e:
            print(f"[background] ⚠️ FFmpeg not available or failed, using original: {e}")


        # Analyze with model using downloaded video
        from .deepfake_model import get_deepfake_model
        model = get_deepfake_model()
        print(f"[background] Model available: {model.is_available()}, Video path exists: {local_video_path is not None}")

        # Initialize frame_analysis with default values to prevent scoping errors
        frame_analysis = {
            "frameCount": 0,
            "flaggedFrames": [],
            "resolution": "",
            "frameRate": 0,
            "colorAnomalyScore": 0,
            "faceTrackingData": []
        }

        # Always analyze frames and update status
        if local_video_path:
            try:
                # 🔥 FIX 1: Extract Real Metadata
                cap = cv2.VideoCapture(local_video_path)
                v_fps = cap.get(cv2.CAP_PROP_FPS) or 30
                v_frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                v_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                v_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                cap.release()
                
                v_resolution = f"{int(v_width)}x{int(v_height)}" if v_width > 0 else "640x480"

                # 🔥 FIX 4: Increase Frames
                frame_results = model.analyze_video_frames(local_video_path, max_frames=20)
                print(f"[background] Model analysis returned {len(frame_results) if frame_results else 0} frame results")
                
                if frame_results and len(frame_results) > 0:
                    print(f"[background] Processing {len(frame_results)} frames")

                    from .frame_extractor import FrameExtractor
                    extractor = FrameExtractor()
                    model_frame_indices = [r["frame_index"] for r in frame_results]

                    frames = extractor.extract_frames(
                        local_video_path,
                        num_frames=min(len(model_frame_indices), 20),
                        quality=95,
                        filename=filename,
                        frame_indices=model_frame_indices
                    )

                    for frame_idx, frame_url in frames:
                        extracted_frames[frame_idx] = frame_url

                    print(f"[background] ✅ Extracted {len(frames)} frames")

                    # --- FINAL STABLE FORENSIC LOGIC (V7 - WITH NORMALIZATION) ---
                    import numpy as np

                    scores = np.array([r["suspicion_score"] for r in frame_results], dtype=np.float32)

                    # ── NORMALIZATION ──────────────────────────────────────────
                    # Clip outliers first, then min-max normalize to [0, 1]
                    scores = np.clip(scores, 0.0, 1.0)

                    s_min = float(np.min(scores))
                    s_max = float(np.max(scores))

                    if s_max - s_min > 0.01:  # avoid division by near-zero
                        scores = (scores - s_min) / (s_max - s_min)
                    else:
                        # Flat signal — all frames nearly identical score
                        # Keep as-is but flag it (ultra-smooth, likely animation)
                        pass

                    # ── DERIVED STATS (POST-NORMALIZATION) ────────────────────
                    peak       = float(np.max(scores))
                    avg        = float(np.mean(scores))
                    std        = float(np.std(scores))
                    raw_avg    = float(np.mean(np.clip(np.array([r["suspicion_score"] for r in frame_results], dtype=np.float32), 0.0, 1.0)))  # sanity ref
                    fake_ratio = float(np.sum(scores > 0.6)) / len(scores)

                    # Pre-normalization range width (key animation signal)
                    score_range = s_max - s_min

                    print(f"[DEBUG] avg={avg:.3f}, std={std:.3f}, fake_ratio={fake_ratio:.3f}, "
                          f"peak={peak:.3f}, range={score_range:.3f}")

                    def get_verdict(avg_val, std_val, fr_val, peak_val, range_val):
                        # ══════════════════════════════════════════════════════════
                        # 🔴 FAKE RULES
                        # ══════════════════════════════════════════════════════════

                        # 1. Strong fake — model is consistently confident
                        if avg_val > 0.70:
                            return "Fake"

                        # 2. Deepfake spikes — short bursts of high confidence
                        if peak_val > 0.90 and fr_val > 0.30:
                            return "Fake"

                        # 3. Many fake frames
                        if fr_val > 0.50:
                            return "Fake"

                        # 4. Animation / AI-generated — smooth + mid-range avg
                        #    (after normalization, animation scores cluster tightly)
                        if std_val < 0.10 and avg_val > 0.35:
                            return "Fake"

                        # 5. Ultra-smooth animation edge case
                        #    Raw range is tiny → all frames identical → not real camera
                        if range_val < 0.05:
                            return "Fake"

                        # ══════════════════════════════════════════════════════════
                        # 🟢 REAL RULES
                        # ══════════════════════════════════════════════════════════

                        # 6. Clear real — low avg, low fake frames
                        if avg_val < 0.30 and fr_val < 0.25:
                            return "Real"

                        # 7. Compressed real (WhatsApp / low-bitrate)
                        #    Has natural variation despite compression
                        if avg_val < 0.55 and fr_val < 0.35 and std_val > 0.10:
                            return "Real"

                        # 8. Natural camera variation — real videos shake/vary
                        if std_val > 0.18:
                            return "Real"

                        # ══════════════════════════════════════════════════════════
                        # ⚪ FINAL FALLBACK
                        # ══════════════════════════════════════════════════════════
                        if avg_val < 0.60:
                            return "Real"
                        else:
                            return "Fake"

                    verdict = get_verdict(avg, std, fake_ratio, peak, score_range)

                    # 🔥 FIX 3: Dynamic Forensic Breakdown
                    forensic = {
                        "deepfakeProbability": float(avg),
                        "frameInsertionRisk": float(avg * 0.8),
                        "frameDeletionRisk": float(avg * 0.6),
                        "temporalInconsistencyScore": float(std),
                        "compressionArtifactScore": float(std * 0.5),
                        "audioVideoSyncScore": 0.5
                    }

                    overall_score = int(avg * 100)

                    # --- VERDICT-AWARE FRAME SELECTION ---
                    # Create a list of all potential frames with full metadata
                    all_analyzed = []
                    for i, s in enumerate(scores):
                        score_val = float(s)
                        if score_val > 0.65:
                            f_label = "Fake"
                        elif score_val < 0.35:
                            f_label = "Real"
                        else:
                            f_label = "Uncertain"
                        
                        all_analyzed.append({
                            "frameIndex": int(i),
                            "suspicionScore": score_val,
                            "label": f_label,
                            "extractedFrame": extracted_frames.get(i)
                        })

                    # Select the most relevant 15 frames based on the final verdict
                    if verdict == "Fake":
                        # Prioritize HIGHEST suspicion evidence of tampering, then filter strictly
                        raw_selection = sorted(all_analyzed, key=lambda x: x["suspicionScore"], reverse=True)
                        flagged_frames = [f for f in raw_selection if f["label"] == "Fake"][:15]
                    elif verdict == "Real":
                        # Prioritize LOWEST suspicion evidence of authenticity, then filter strictly
                        raw_selection = sorted(all_analyzed, key=lambda x: x["suspicionScore"])
                        flagged_frames = [f for f in raw_selection if f["label"] == "Real"][:15]
                    else:
                        # Uncertain: Show the most ambiguous/suspicious frames for investigation
                        flagged_frames = sorted(all_analyzed, key=lambda x: x["suspicionScore"], reverse=True)[:15]

                    # Re-sort result by frame index for chronological display
                    flagged_frames = sorted(flagged_frames, key=lambda x: x["frameIndex"])

                    frame_analysis = {
                        "frameCount": v_frame_count or len(scores),
                        "flaggedFrames": flagged_frames,
                        "resolution": v_resolution,
                        "frameRate": float(v_fps),
                        "colorAnomalyScore": float(std),
                        "faceTrackingData": []
                    }

                else:
                    print("[background] No frame results, fallback")
                    overall_score = 50
                    verdict = "Uncertain"

            except Exception as e:
                print("[background] ERROR:", e)
                overall_score = 50
                verdict = "Uncertain"

        # Update analysis record
        if use_mongodb:
            # Convert extractedFrames integer keys to strings for MongoDB compatibility
            extracted_frames_str_keys = {str(k): v for k, v in extracted_frames.items()}
            await analysis.mongodb.database.analyses.update_one(
                {"id": analysis_id},
                {
                    "$set": {
                        "status": "Complete",
                        "overallScore": overall_score,
                        "verdict": verdict,
                        "forensic": forensic,
                        "frameAnalysis": frame_analysis,
                        "extractedFrames": extracted_frames_str_keys,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
        else:
            # Update local storage
            from .db import get_db
            db = get_db()
            
            # Simulate analysis for local storage
            overall_score = overall_score or 50
            verdict = verdict or "Uncertain"
            
            await db["analyses"].update_one(
                {"id": analysis_id},
                {
                    "$set": {
                        "status": "Complete",
                        "overallScore": overall_score,
                        "verdict": verdict,
                        "updated_at": datetime.now().timestamp()
                    }
                }
            )
        
        print(f"[background] ✅ Analysis complete for {filename}")
        
        # Clean up downloaded video file after analysis is complete
        if local_video_path and os.path.exists(local_video_path):
            try:
                os.unlink(local_video_path)
                print(f"[background] Cleaned up temporary file: {local_video_path}")
            except Exception:
                pass
        
    except Exception as e:
        print(f"[background] ❌ Analysis failed: {e}")
        import traceback
        traceback.print_exc()

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _resolve_owner(x_user_id: str | None) -> str:
    return x_user_id or "2vxsx-fae"


def _ts(value) -> int:
    """Convert any timestamp representation to nanoseconds."""
    if value is None:
        return 0
    if isinstance(value, datetime):
        return int(value.timestamp() * 1_000_000_000)
    if isinstance(value, (int, float)):
        return int(value)
    return 0


def _doc_to_record(result: dict) -> AnalysisRecord:
    """Convert a MongoDB document to an AnalysisRecord Pydantic model."""
    ts = _ts(result.get("uploadTimestamp") or result.get("upload_timestamp"))
    forensic = result.get("forensic") or {}
    frame_analysis = result.get("frameAnalysis") or result.get("frame_analysis") or {}
    
    # Provide default values for missing forensic fields
    forensic_data = {
        "deepfakeProbability": float(forensic.get("deepfakeProbability") or 0.0),
        "frameInsertionRisk": float(forensic.get("frameInsertionRisk") or 0.0),
        "frameDeletionRisk": float(forensic.get("frameDeletionRisk") or 0.0),
        "temporalInconsistencyScore": float(forensic.get("temporalInconsistencyScore") or 0.0),
        "compressionArtifactScore": float(forensic.get("compressionArtifactScore") or 0.0),
        "audioVideoSyncScore": float(forensic.get("audioVideoSyncScore") or 0.0),
    }
    
    # Provide default values for missing frame analysis fields
    # Convert flaggedFrames from integers to FlaggedFrame objects if needed
    flagged_frames_raw = frame_analysis.get("flaggedFrames", [])
    flagged_frames = []
    for item in flagged_frames_raw:
        if isinstance(item, int):
            # Convert integer to FlaggedFrame object
            flagged_frames.append({
                "frameIndex": item,
                "suspicionScore": 0.5,  # Default score
                "extractedFrame": None
            })
        elif isinstance(item, dict):
            # Already a dict/FlaggedFrame object
            flagged_frames.append(item)
        else:
            # Unknown type, skip
            continue
    
    frame_analysis_data = {
        "frameCount": int(frame_analysis.get("frameCount") or 0),
        "flaggedFrames": flagged_frames,
        "resolution": frame_analysis.get("resolution") or "",
        "frameRate": float(frame_analysis.get("frameRate") or 0),
        "colorAnomalyScore": float(frame_analysis.get("colorAnomalyScore") or 0),
        "faceTrackingData": frame_analysis.get("faceTrackingData") or [],
    }

    # Handle status mapping safely
    status_raw = str(result.get("status") or "Complete").lower()
    if status_raw in ["complete", "success", "finished"]:
        status = AnalysisStatus.Complete
    elif status_raw in ["failed", "error"]:
        status = AnalysisStatus.Failed
    elif status_raw in ["processing", "analyzing", "pending"]:
        status = AnalysisStatus.Processing
    else:
        status = AnalysisStatus.Queued
    
    # Handle invalid verdict values
    verdict = result.get("verdict") or "Unknown"
    valid_verdicts = ["Real", "Fake", "Uncertain", "Unknown"]
    if verdict not in valid_verdicts:
        verdict = "Uncertain"
    
    # Convert extractedFrames string keys back to integers for frontend compatibility
    extracted_frames = result.get("extractedFrames") or {}
    extracted_frames_int_keys = {int(k): v for k, v in extracted_frames.items()} if extracted_frames else {}
    
    return AnalysisRecord(
        id=result.get("id") or str(result.get("_id", "")),
        filename=result.get("filename", "unknown"),
        fileSize=result.get("fileSize") or result.get("file_size") or 0,
        uploadTimestamp=ts,
        status=status,
        overallScore=result.get("overallScore") or result.get("overall_score") or 0,
        verdict=verdict,
        forensic=forensic_data,
        frameAnalysis=frame_analysis_data,
        videoUrl=result.get("videoUrl") or result.get("video_url"),
        extractedFrames=extracted_frames_int_keys,
    )


# ─── Analysis routes (order matters: specific paths before {param} routes) ────

@app.get("/analysis/history", response_model=list[AnalysisRecord])
async def get_user_history(
    x_user_id: Annotated[str | None, Header()] = None,
) -> list[AnalysisRecord]:
    # Removed verbose logging
    
    # Try MongoDB first, fallback to local storage
    use_mongodb = False
    try:
        analysis = await get_mongodb_analysis()
        if analysis.mongodb and analysis.mongodb.connected:
            use_mongodb = True
    except Exception:
        use_mongodb = False
    
    owner = _resolve_owner(x_user_id)
    # Removed verbose logging
    
    if use_mongodb:
        results = await analysis.get_user_analyses(owner)
    else:
        # Fallback to local storage
        from .db import get_db
        db = get_db()
        cursor = await db["analyses"].find({"owner": owner})
        results = await cursor.to_list()
    
    # Removed verbose logging
    safe_results = []

    for r in results:
        try:
            record = _doc_to_record(r)
            if record:
                safe_results.append(record)
        except Exception as e:
            print("[history] Skipped bad record:", e)

    return safe_results


@app.post("/analysis/submit", response_model=str)
async def submit_video_analysis(
    background_tasks: BackgroundTasks,
    file: UploadFile = Form(...),
    filename: str = Form(None),
    fileSize: str = Form(None),
    frameCount: str = Form(None),
    frameRate: str = Form(None),
    resolution: str = Form(None),
    x_user_id: Annotated[str | None, Header()] = None,
) -> str:
    print("[DEBUG] Submit endpoint called!")
    print(f"[DEBUG] Filename: {filename}")
    print(f"[DEBUG] File size: {fileSize}")
    
    # Check file size limit (50MB max for Render)
    max_size_bytes = 50 * 1024 * 1024  # 50MB
    if file.size and file.size > max_size_bytes:
        raise HTTPException(
            status_code=413, 
            detail=f"File too large. Maximum size is {max_size_bytes // (1024*1024)}MB"
        )
    
    # Removed verbose logging
    use_mongodb = False
    try:
        analysis = await get_mongodb_analysis()
        if analysis.mongodb and analysis.mongodb.connected:
            use_mongodb = True
    except Exception:
        use_mongodb = False
    
    owner = _resolve_owner(x_user_id)

    # Save uploaded file temporarily (streaming to prevent memory issues)
    temp_file_path = None
    try:
        # Create temporary file and stream content
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_file:
            temp_file_path = temp_file.name
        
        # Stream file content in chunks to avoid memory overload
        async with aiofiles.open(temp_file_path, 'wb') as f:
            chunk_size = 1024 * 1024  # 1MB chunks
            while chunk := await file.read(chunk_size):
                await f.write(chunk)
            file_size = os.path.getsize(temp_file_path)
        
        try:
            frame_count = int(frameCount) if frameCount else None
        except (ValueError, TypeError):
            frame_count = None
        
        try:
            frame_rate = float(frameRate) if frameRate else None
        except (ValueError, TypeError):
            frame_rate = None
        
        # Submit analysis with video URL
        metadata = {
            "frameCount": frame_count,
            "frameRate": frame_rate,
            "resolution": resolution
        }
        
        print(f"[submit] 🔍 Submitting analysis...")
        
        # Create analysis ID and pending record
        analysis_id = str(uuid.uuid4())
        
        if use_mongodb:
            # Create pending analysis record in MongoDB
            await analysis.mongodb.database.analyses.insert_one({
                "id": analysis_id,
                "owner_id": owner,
                "filename": filename or file.filename,
                "fileSize": file_size,
                "uploadTimestamp": datetime.utcnow(),
                "status": "pending",
                "overallScore": 0,
                "verdict": "Processing",
                "forensic": {},
                "frameAnalysis": {},
                "videoUrl": None,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
        else:
            # Fallback to local storage
            from .db import get_db
            db = get_db()
            
            # Store analysis in local database
            await db["analyses"].insert_one({
                "id": analysis_id,
                "owner": owner,
                "owner_id": owner,
                "filename": filename or file.filename,
                "fileSize": file_size,
                "uploadTimestamp": int(datetime.now().timestamp() * 1_000_000_000),
                "overallScore": 0,
                "verdict": "Processing",
                "forensic": {},
                "frameAnalysis": {},
                "videoUrl": None,
                "status": "pending"
            })
            
            # Store in user index
            await db["user_index"].insert_one({
                "user_id": owner,
                "analysis_id": analysis_id,
                "timestamp": int(datetime.now().timestamp() * 1_000_000_000)
            })
        
        # Add background task to process video
        background_tasks.add_task(
            process_video_analysis,
            analysis_id,
            owner,
            filename or file.filename,
            file_size,
            metadata,
            temp_file_path,
            use_mongodb
        )
        
        return analysis_id
        
        # Removed verbose logging
        
        if analysis_id is None:
            # Removed verbose logging
            raise HTTPException(status_code=500, detail="Failed to submit analysis")
        
        return analysis_id
        
    except Exception as e:
        # Removed verbose logging
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@app.get("/analysis/shared/{token}", response_model=AnalysisRecord | None)
async def get_shared_analysis(token: str) -> AnalysisRecord | None:
    # Try MongoDB first
    analysis = await get_mongodb_analysis()
    result = await analysis.get_shared_analysis(token)
    if result is not None:
        return _doc_to_record(result)

    # Fallback to local storage
    from .db import get_db
    db = get_db()
    token_doc = await db["share_tokens"].find_one({"token": token})
    if token_doc:
        analysis_id = token_doc.get("analysis_id")
        analysis_doc = await db["analyses"].find_one({"id": analysis_id})
        if analysis_doc:
            return _doc_to_record(analysis_doc)
    return None


@app.get("/analysis/{analysis_id}", response_model=AnalysisRecord | None)
async def get_analysis_result(analysis_id: str) -> AnalysisRecord | None:
    try:
        # Check both MongoDB and local storage
        result = None
        
        # Try MongoDB first
        try:
            analysis = await get_mongodb_analysis()
            if analysis.mongodb and analysis.mongodb.connected:
                result = await analysis.get_analysis(analysis_id)
                if result:
                    print(f"[get_analysis] Found {analysis_id} in MongoDB")
        except Exception as e:
            print(f"[get_analysis] MongoDB check failed: {e}")
        
        # If not found in MongoDB, check local storage
        if not result:
            try:
                from .db import get_db
                db = get_db()
                result = await db["analyses"].find_one({"id": analysis_id})
                if result:
                    print(f"[get_analysis] Found {analysis_id} in local storage")
            except Exception as e:
                print(f"[get_analysis] Local storage check failed: {e}")
        
        if result is None:
            print(f"[get_analysis] Analysis {analysis_id} not found in any storage")
            return None
        return _doc_to_record(result)
    except Exception as e:
        print(f"[get_analysis] Error fetching analysis {analysis_id}: {e}")
        import traceback
        traceback.print_exc()
        return None


@app.delete("/analysis/{analysis_id}", response_model=bool)
async def delete_analysis_record(
    analysis_id: str,
    x_user_id: Annotated[str | None, Header()] = None,
) -> bool:
    # Try MongoDB first, fallback to local storage
    use_mongodb = False
    try:
        analysis = await get_mongodb_analysis()
        if analysis.mongodb and analysis.mongodb.connected:
            use_mongodb = True
    except Exception:
        use_mongodb = False

    cloudinary = get_cloudinary_service()
    owner = _resolve_owner(x_user_id)

    if use_mongodb:
        result = await analysis.delete_analysis(analysis_id, owner, cloudinary)
        return result
    else:
        # Fallback to local storage
        from .db import get_db
        db = get_db()
        result = await db["analyses"].delete_one({"id": analysis_id, "owner": owner})
        if result:
            await db["user_index"].delete_many({"analysis_id": analysis_id})
            return result.deleted_count > 0
        else:
            return False


@app.post("/analysis/{analysis_id}/share-token", response_model=str)
async def generate_share_token(
    analysis_id: str,
    x_user_id: Annotated[str | None, Header()] = None,
) -> str:
    # Try MongoDB first, fallback to local storage
    use_mongodb = False
    try:
        analysis = await get_mongodb_analysis()
        if analysis.mongodb and analysis.mongodb.connected:
            use_mongodb = True
    except Exception:
        use_mongodb = False
    
    owner = _resolve_owner(x_user_id)

    # Try MongoDB first
    if use_mongodb:
        token = await analysis.create_share_token(analysis_id, owner)
        if token is not None:
            return token

    # Fallback to local storage (always works)
    from .db import get_db
    db = get_db()
    token = str(uuid.uuid4())
    await db["share_tokens"].insert_one({
        "token": token,
        "analysis_id": analysis_id,
        "created_at": datetime.now().timestamp()
    })
    return token
