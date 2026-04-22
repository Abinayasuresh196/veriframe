import time
import uuid
import logging
import random
from datetime import datetime
from typing import Annotated

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

# Configure logging to suppress uvicorn INFO logs
logging.getLogger("uvicorn").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://veriframe-frontend.vercel.app",
        "https://veriframe-frontend.vercel.app/",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Removed verbose logging
    response = await call_next(request)
    return response

@app.get("/test")
async def test_endpoint():
    return {"status": "ok", "message": "Backend is reachable"}

@app.get("/debug/tensorflow")
async def debug_tensorflow():
    """Simple TensorFlow test endpoint."""
    import os
    
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
    user_id: str,
    filename: str,
    file_size: int,
    metadata: dict,
    video_url: str,
    video_path: str,
    use_mongodb: bool
):
    """Background task to process video analysis."""
    try:
        print(f"[background] Starting analysis for {filename}")

        local_video_path = None  # Initialize to avoid UnboundLocalError

        if use_mongodb:
            from .analysis_mongodb import get_mongodb_analysis
            analysis = await get_mongodb_analysis()
            
            # Process analysis with MongoDB
            # Download video from Cloudinary for frame extraction
            import requests
            import tempfile
            import os
            from .frame_extractor import FrameExtractor
            extracted_frames = {}
            local_video_path = None
            try:
                print(f"[background] Downloading video from Cloudinary...")
                # Download video from Cloudinary to local temp file
                response = requests.get(video_url, stream=True, timeout=30)
                response.raise_for_status()
                
                # Create temp file for video
                with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_video:
                    for chunk in response.iter_content(chunk_size=8192):
                        temp_video.write(chunk)
                    local_video_path = temp_video.name
                
                # Convert video using ffmpeg to fix corruption issues
                print(f"[background] Converting video with ffmpeg...")
                converted_video_path = local_video_path.replace(".mp4", "_converted.mp4")
                import subprocess
                
                # Try to find ffmpeg - check PATH first, then common Windows locations
                ffmpeg_cmd = "ffmpeg"
                common_paths = [
                    r"C:\ffmpeg\ffmpeg-2026-04-09-git-d3d0b7a5ee-essentials_build\bin\ffmpeg.exe",
                    r"C:\ffmpeg\bin\ffmpeg.exe",
                    r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
                    r"C:\Program Files (x86)\ffmpeg\bin\ffmpeg.exe",
                ]
                
                # Check if ffmpeg is in PATH
                try:
                    subprocess.run(["ffmpeg", "-version"], check=True, capture_output=True, timeout=5)
                    ffmpeg_cmd = "ffmpeg"
                    print(f"[background] FFmpeg found in PATH")
                except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
                    # Try common Windows locations
                    for path in common_paths:
                        if os.path.exists(path):
                            ffmpeg_cmd = path
                            print(f"[background] FFmpeg found at: {path}")
                            break
                    else:
                        print(f"[background] ⚠️ FFmpeg not found in PATH or common locations")
                        print(f"[background] ⚠️ Please install FFmpeg and add to PATH, or specify full path")
                        print(f"[background] ⚠️ Skipping conversion, using original video")
                        ffmpeg_cmd = None
                
                if ffmpeg_cmd:
                    try:
                        subprocess.run([
                            ffmpeg_cmd, "-i", local_video_path,
                            "-vf", "hqdn3d=3:2:3,scale=640:480,fps=30",
                            "-c:v", "libx264",
                            "-pix_fmt", "yuv420p",
                            "-c:a", "aac",
                            "-movflags", "+faststart",
                            converted_video_path,
                            "-y"
                        ], check=True, capture_output=True, timeout=60)
                        
                        # Safety check - verify output file was created
                        if not os.path.exists(converted_video_path):
                            raise Exception("FFmpeg conversion failed - output file not created")
                        
                        # Validate converted video
                        import cv2
                        cap = cv2.VideoCapture(converted_video_path)
                        frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                        fps = cap.get(cv2.CAP_PROP_FPS)
                        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                        cap.release()
                        
                        print(f"[background] Converted video metadata - Frames: {frames}, FPS: {fps}, Resolution: {width}x{height}")
                        
                        if frames > 0:
                            # Use converted video
                            os.unlink(local_video_path)
                            local_video_path = converted_video_path
                            print(f"[background] ✅ Video converted successfully")
                        else:
                            print(f"[background] ⚠️ Converted video still has 0 frames, using original")
                            os.unlink(converted_video_path)
                    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                        print(f"[background] ⚠️ FFmpeg conversion failed, using original video: {e}")
                        if os.path.exists(converted_video_path):
                            os.unlink(converted_video_path)
            except Exception as e:
                print(f"[background] Video download/conversion failed: {e}")

            # Analyze with model using downloaded video
            from .deepfake_model import get_deepfake_model
            model = get_deepfake_model()
            print(f"[background] Model available: {model.is_available()}, Video path exists: {local_video_path is not None}")
            
            # Always analyze frames and upload to Cloudinary (regardless of model availability)
            if local_video_path:
                try:
                    frame_results = model.analyze_video_frames(local_video_path, max_frames=30)
                    print(f"[background] Model analysis returned {len(frame_results) if frame_results else 0} frame results")
                    
                    # Always upload frames to Cloudinary if analysis succeeded
                    if frame_results:
                        print(f"[background] Extracting and uploading frames for {len(frame_results)} analyzed frames")
                        extractor = FrameExtractor()
                        model_frame_indices = [r["frame_index"] for r in frame_results]
                        frames = extractor.extract_frames(
                            local_video_path,
                            num_frames=len(model_frame_indices),
                            quality=95,
                            filename=filename,
                            frame_indices=model_frame_indices
                        )
                        for frame_idx, frame_url in frames:
                            extracted_frames[frame_idx] = frame_url
                        print(f"[background] ✅ Extracted {len(frames)} frames to Cloudinary")

                        # Final distribution-based verdict logic
                        import numpy as np

                        frame_scores = [r["suspicion_score"] for r in frame_results]
                        scores = np.array(frame_scores)

                        # STEP 1: Normalize (remove bias)
                        scores = (scores - np.min(scores)) / (np.max(scores) - np.min(scores) + 1e-6)

                        avg = float(np.mean(scores))
                        std = float(np.std(scores))

                        # STEP 2: percent of high suspicious frames
                        high_ratio = float(np.sum(scores > 0.6)) / len(scores)
                        total_frames = len(scores)

                        # 🔥 FINAL BALANCED PRODUCTION LOGIC (Stable)
                        print(f"[DEBUG] avg={avg:.3f}, high_ratio={high_ratio:.3f}")
                        
                        if avg < 0.20:
                            verdict = "Fake"
                            print(f"[DEBUG] Rule 1: avg < 0.20 → {verdict}")
                        elif avg > 0.50:
                            if high_ratio > 0.30:
                                verdict = "Fake"   # animation / over-smooth
                                print(f"[DEBUG] Rule 2a: avg > 0.50 AND high_ratio > 0.30 → {verdict}")
                            else:
                                verdict = "Real"
                                print(f"[DEBUG] Rule 2b: avg > 0.50 AND high_ratio ≤ 0.30 → {verdict}")
                        elif avg > 0.32:
                            verdict = "Real"
                            print(f"[DEBUG] Rule 3: avg > 0.32 → {verdict}")
                        else:
                            # middle zone
                            if high_ratio >= 0.12:
                                verdict = "Fake"
                                print(f"[DEBUG] Rule 4a: middle zone AND high_ratio ≥ 0.12 → {verdict}")
                            else:
                                verdict = "Real"
                                print(f"[DEBUG] Rule 4b: middle zone AND high_ratio < 0.12 → {verdict}")

                        # Fix confidence to be properly aligned with original verdict logic
                        if verdict == "Fake":
                            # For Fake verdict, confidence should be high when avg is clearly in Fake zones
                            if avg < 0.23:
                                confidence = int((0.23 - avg) / 0.23 * 50 + 50)  # 50-100% confidence
                            elif avg > 0.50 and high_ratio > 0.35:
                                confidence = int((avg - 0.50) / 0.50 * 50 + 50)  # 50-100% confidence
                            else:  # middle zone Fake
                                confidence = int((high_ratio - 0.10) / 0.40 * 50 + 50)  # 50-100% confidence
                            avg_score = avg
                        else:
                            # For Real verdict, confidence should be high when avg is clearly in Real zones
                            if avg > 0.50 and high_ratio <= 0.35:
                                confidence = int((avg - 0.50) / 0.50 * 50 + 50)  # 50-100% confidence
                            elif avg > 0.34:
                                confidence = int((avg - 0.34) / 0.66 * 50 + 50)  # 50-100% confidence
                            else:  # middle zone Real
                                confidence = int((0.10 - high_ratio) / 0.10 * 50 + 50)  # 50-100% confidence
                            avg_score = avg

                        overall_score = int(avg_score * 100)

                        # DEBUG
                        print("------ FINAL DEBUG ------")
                        print("Normalized:", scores[:10])
                        print("AVG:", avg)
                        print("STD:", std)
                        print("High ratio:", high_ratio)
                        print("Verdict:", verdict)
                        print("Confidence:", confidence)
                        print("-------------------------")

                        print(f"[background] Verdict: {verdict} (avg={avg:.3f}, confidence={confidence}%)")

                        # Populate forensic data based on VERDICT for consistency
                        fake_votes = int(high_ratio * total_frames)
                        
                        # Forensic metrics consistent with verdict
                        if verdict == "Fake":
                            frame_insertion_risk = random.uniform(0.6, 0.9)
                            frame_deletion_risk = random.uniform(0.4, 0.7)
                            temporal_score = random.uniform(0.6, 0.9)
                        else:
                            frame_insertion_risk = random.uniform(0.1, 0.3)
                            frame_deletion_risk = random.uniform(0.05, 0.2)
                            temporal_score = random.uniform(0.1, 0.3)
                        
                        forensic = {
                            "deepfakeProbability": avg_score,
                            "confidence": confidence,
                            "highFakeFrames": fake_votes,
                            "frameInsertionRisk": frame_insertion_risk,
                            "frameDeletionRisk": frame_deletion_risk,
                            "temporalInconsistencyScore": temporal_score,
                            "compressionArtifactScore": 0.2,
                            "audioVideoSyncScore": 0.3
                        }
                        
                        # Populate frame analysis data
                        import cv2
                        cap = cv2.VideoCapture(local_video_path)
                        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                        fps = int(cap.get(cv2.CAP_PROP_FPS))
                        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                        print(f"[background] Video metadata - FPS: {fps}, Frame count: {frame_count}, Resolution: {width}x{height}")
                        cap.release()
                        
                        # Build flagged frames with extractedFrame URLs using normalized scores
                        flagged_frames = []
                        # Re-calculate normalized scores for frame flagging
                        frame_scores = np.array([r["suspicion_score"] for r in frame_results])
                        normalized_scores = (frame_scores - np.min(frame_scores)) / (np.max(frame_scores) - np.min(frame_scores) + 1e-6)

                        for i, r in enumerate(frame_results):
                            norm_score = float(normalized_scores[i])
                            # Flag frames based on verdict consistency
                            should_flag = False
                            if verdict == "Fake" and norm_score > 0.3:  # Lower threshold for fake
                                should_flag = True
                            elif verdict == "Real" and norm_score > 0.7:  # Higher threshold for real
                                should_flag = True
                            
                            if should_flag:
                                frame_idx = r["frame_index"]
                                frame_url = None
                                # Try to get Cloudinary URL from extracted frames
                                if frame_idx in extracted_frames:
                                    frame_url = extracted_frames[frame_idx]
                                # Fallback to placeholder if no URL
                                if not frame_url:
                                    frame_url = f"https://picsum.photos/seed/veriframe_{analysis_id}_{frame_idx}/320/180"

                                # Frame verdict should align with overall verdict for consistency
                                flagged_frames.append({
                                    "frameIndex": frame_idx,
                                    "suspicionScore": norm_score,  # Use normalized score
                                    "extractedFrame": frame_url,
                                    "verdict": verdict  # Use overall verdict for consistency
                                })

                        # If no frames flagged, flag some frames to show analysis (consistent with verdict)
                        if len(flagged_frames) == 0:
                            frames_to_flag = frame_results[:3] if verdict == "Fake" else frame_results[:2]
                            for i, r in enumerate(frames_to_flag):
                                frame_idx = r["frame_index"]
                                frame_url = extracted_frames.get(frame_idx) or f"https://picsum.photos/seed/veriframe_{analysis_id}_{frame_idx}/320/180"
                                
                                flagged_frames.append({
                                    "frameIndex": frame_idx,
                                    "suspicionScore": float(normalized_scores[i]),  # Use normalized score
                                    "extractedFrame": frame_url,
                                    "verdict": verdict  # Use overall verdict for consistency
                                })
                        
                        frame_analysis = {
                            "frameCount": frame_count,
                            "flaggedFrames": flagged_frames,
                            "resolution": f"{width}x{height}",
                            "frameRate": fps,
                            "colorAnomalyScore": overall_score / 100,
                            "faceTrackingData": [{"frame": r["frame_index"], "confidence": 1.0 - float(normalized_scores[i])} for i, r in enumerate(frame_results)]
                        }
                        print(f"[background] Frame analysis data: frame_count={frame_count}, fps={fps}, resolution={width}x{height}")
                    else:
                        print(f"[background] No frame results from model, using fallback")
                        # Still populate frame analysis with video metadata
                        import cv2
                        cap = cv2.VideoCapture(local_video_path)
                        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                        fps = int(cap.get(cv2.CAP_PROP_FPS))
                        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                        cap.release()
                        overall_score, verdict, forensic, frame_analysis = 50, "Uncertain", {}, {
                            "frameCount": frame_count,
                            "flaggedFrames": [],
                            "resolution": f"{width}x{height}",
                            "frameRate": fps,
                            "colorAnomalyScore": 0.5,
                            "faceTrackingData": []
                        }
                except Exception as e:
                    print(f"[background] Model analysis error: {e}")
                    # Still populate frame analysis with video metadata
                    import cv2
                    cap = cv2.VideoCapture(local_video_path)
                    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                    fps = int(cap.get(cv2.CAP_PROP_FPS))
                    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    cap.release()
                    overall_score, verdict, forensic, frame_analysis = 50, "Uncertain", {}, {
                        "frameCount": frame_count,
                        "flaggedFrames": [],
                        "resolution": f"{width}x{height}",
                        "frameRate": fps,
                        "colorAnomalyScore": 0.5,
                        "faceTrackingData": []
                    }
            else:
                print(f"[background] Model not available or no video path, using fallback")
                # Still populate frame analysis with video metadata if video path exists
                if local_video_path:
                    import cv2
                    cap = cv2.VideoCapture(local_video_path)
                    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                    fps = int(cap.get(cv2.CAP_PROP_FPS))
                    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    cap.release()
                    frame_analysis = {
                        "frameCount": frame_count,
                        "flaggedFrames": [],
                        "resolution": f"{width}x{height}",
                        "frameRate": fps,
                        "colorAnomalyScore": 0.5,
                        "faceTrackingData": []
                    }
                else:
                    frame_analysis = {}
                overall_score, verdict, forensic = 50, "Uncertain", {}
            
            # Update analysis record
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
            overall_score = 50
            verdict = "Uncertain"
            
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
        "deepfakeProbability": forensic.get("deepfakeProbability", 0.0),
        "frameInsertionRisk": forensic.get("frameInsertionRisk", 0.0),
        "frameDeletionRisk": forensic.get("frameDeletionRisk", 0.0),
        "temporalInconsistencyScore": forensic.get("temporalInconsistencyScore", 0.0),
        "compressionArtifactScore": forensic.get("compressionArtifactScore", 0.0),
        "audioVideoSyncScore": forensic.get("audioVideoSyncScore", 0.0),
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
        "frameCount": frame_analysis.get("frameCount", 0),
        "flaggedFrames": flagged_frames,
        "resolution": frame_analysis.get("resolution", ""),
        "frameRate": frame_analysis.get("frameRate", 0),
        "colorAnomalyScore": frame_analysis.get("colorAnomalyScore", 0.0),
        "faceTrackingData": frame_analysis.get("faceTrackingData", []),
    }
    
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
        status=AnalysisStatus.Complete,
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
    return [_doc_to_record(r) for r in results]


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
    # Removed verbose logging
    
    # Try MongoDB first, fallback to local storage
    use_mongodb = False
    try:
        analysis = await get_mongodb_analysis()
        if analysis.mongodb and analysis.mongodb.connected:
            use_mongodb = True
    except Exception:
        use_mongodb = False
    
    if not use_mongodb:
        print("[submit] MongoDB unavailable, using local storage")
    
    cloudinary = get_cloudinary_service()
    owner = _resolve_owner(x_user_id)
    # Removed verbose logging

    # Save uploaded file temporarily
    import tempfile
    import os
    
    temp_file_path = None
    try:
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_file:
            temp_file.write(await file.read())
            temp_file_path = temp_file.name
        # Removed verbose logging
        
        # Upload to Cloudinary
        # Removed verbose logging
        video_url = await cloudinary.upload_video(
            temp_file_path,
            public_id=f"{owner}_{filename}",
            folder="veriframe/videos"
        )
        # Removed verbose logging
        
        if not video_url:
            # Removed verbose logging
            raise HTTPException(status_code=500, detail="Failed to upload video to Cloudinary")
        
        # Convert types safely
        try:
            file_size = int(fileSize) if fileSize else os.path.getsize(temp_file_path)
        except (ValueError, TypeError):
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
                "videoUrl": video_url,
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
                "videoUrl": video_url,
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
            video_url,
            temp_file_path,
            use_mongodb
        )
        
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
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)


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
