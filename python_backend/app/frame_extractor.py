"""Frame extraction service for video analysis."""

import cv2
import tempfile
import os
from typing import List, Tuple
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)


class FrameExtractor:
    """Service for extracting frames from videos and uploading to Cloudinary."""
    
    def __init__(self):
        """Initialize the frame extractor."""
        pass
    
    def extract_frames(
        self,
        video_path: str,
        num_frames: int = 10,
        quality: int = 95,
        filename: str = None,
        frame_indices: List[int] = None
    ) -> List[Tuple[int, str]]:
        """
        Extract frames from video at regular intervals or specific indices.
        
        Args:
            video_path: Path to the video file
            num_frames: Number of frames to extract (if frame_indices not provided)
            quality: JPEG quality (1-100, higher is better)
            filename: Original video filename for unique public_id
            frame_indices: Specific frame indices to extract (overrides num_frames)
            
        Returns:
            List of tuples (frame_index, frame_url)
        """
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            raise ValueError(f"Could not open video file: {video_path}")
        
        try:
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS)

            if total_frames <= 0:
                raise ValueError("Video has no frames")

            # Use provided frame_indices or calculate evenly distributed indices
            if frame_indices is None:
                frame_indices = []
                if num_frames >= total_frames:
                    frame_indices = list(range(total_frames))
                else:
                    step = total_frames // num_frames
                    frame_indices = [i * step for i in range(num_frames)]
            
            extracted_frames = []
            
            for frame_idx in frame_indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                ret, frame = cap.read()
                
                if ret:
                    try:
                        # Save frame to temporary file with high quality
                        temp_frame = tempfile.NamedTemporaryFile(
                            delete=False,
                            suffix=".jpg"
                        )
                        temp_frame_path = temp_frame.name
                        temp_frame.close()
                        
                        # Encode with high quality
                        success = cv2.imwrite(
                            temp_frame_path,
                            frame,
                            [cv2.IMWRITE_JPEG_QUALITY, quality]
                        )
                        
                        if not success:
                            print(f"[frame_extractor] Failed to write frame {frame_idx}")
                            continue
                        
                        # Upload to Cloudinary with unique public_id
                        unique_id = f"{filename}_{frame_idx}" if filename else f"frame_{frame_idx}"
                        frame_url = self._upload_frame_to_cloudinary(
                            temp_frame_path,
                            unique_id
                        )
                        
                        if frame_url:
                            extracted_frames.append((frame_idx, frame_url))
                            print(f"[frame_extractor] Successfully extracted frame {frame_idx}: {frame_url[:60]}...")
                        else:
                            print(f"[frame_extractor] Cloudinary upload failed for frame {frame_idx}")
                        
                        # Clean up temporary file
                        os.unlink(temp_frame_path)
                    except Exception as e:
                        print(f"[frame_extractor] Error processing frame {frame_idx}: {e}")
            
            print(f"[frame_extractor] Total frames extracted: {len(extracted_frames)}/{len(frame_indices)}")
            return extracted_frames
            
        finally:
            cap.release()
    
    def _upload_frame_to_cloudinary(
        self,
        frame_path: str,
        public_id: str
    ) -> str:
        """
        Upload a frame to Cloudinary.
        
        Args:
            frame_path: Path to the frame image file
            public_id: Public ID for Cloudinary
            
        Returns:
            URL of the uploaded frame
        """
        try:
            result = cloudinary.uploader.upload(
                frame_path,
                public_id=public_id,
                folder="veriframe/frames",
                quality="auto:best",
                fetch_format="jpg"
            )
            secure_url = result.get("secure_url")
            if secure_url:
                return secure_url
            else:
                print(f"[frame_extractor] Cloudinary upload failed: no secure_url in response")
                return None
        except Exception as e:
            print(f"[frame_extractor] Cloudinary upload error: {e}")
            return None
