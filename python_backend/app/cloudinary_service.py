"""Cloudinary service for video storage and management."""

import os
from typing import Optional
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader

# Load .env file to make variables available to os.getenv()
load_dotenv()

class CloudinaryService:
    """Service for uploading and managing videos on Cloudinary."""
    
    def __init__(self):
        """Initialize Cloudinary configuration."""
        cloudinary.config(
            cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
            api_key=os.getenv("CLOUDINARY_API_KEY"),
            api_secret=os.getenv("CLOUDINARY_API_SECRET"),
            secure=True
        )
    
    async def upload_video(
        self,
        file_path: str,
        public_id: Optional[str] = None,
        folder: str = "veriframe/videos"
    ) -> Optional[str]:
        """
        Upload a video to Cloudinary.
        
        Args:
            file_path: Path to the video file
            public_id: Optional custom public ID for the video
            folder: Cloudinary folder to store the video
            
        Returns:
            Public URL of the uploaded video, or None if upload fails
        """
        try:
            upload_result = cloudinary.uploader.upload(
                file_path,
                resource_type="video",
                public_id=public_id,
                folder=folder,
                eager=[
                    {
                        "format": "mp4",
                        "transformation": [
                            {"quality": "auto", "fetch_format": "auto"}
                        ]
                    }
                ],
                eager_async=True
            )
            
            # Return the secure URL
            return upload_result.get("secure_url")
            
        except Exception as e:
            # Removed verbose logging
            return None
    
    async def delete_video(self, public_id: str) -> bool:
        """
        Delete a video from Cloudinary.
        
        Args:
            public_id: Public ID of the video to delete
            
        Returns:
            True if deletion successful, False otherwise
        """
        try:
            result = cloudinary.uploader.destroy(
                public_id,
                resource_type="video"
            )
            return result.get("result") == "ok"
            
        except Exception as e:
            # Removed verbose logging
            return False
    
    async def delete_image(self, public_id: str) -> bool:
        """
        Delete an image from Cloudinary.
        
        Args:
            public_id: Public ID of the image to delete
            
        Returns:
            True if deletion successful, False otherwise
        """
        try:
            result = cloudinary.uploader.destroy(
                public_id,
                resource_type="image"
            )
            return result.get("result") == "ok"
            
        except Exception as e:
            # Removed verbose logging
            return False
    
    async def get_video_url(self, public_id: str) -> Optional[str]:
        """
        Get the public URL of a video.
        
        Args:
            public_id: Public ID of the video
            
        Returns:
            Public URL of the video, or None if not found
        """
        try:
            resource = cloudinary.api.resource(public_id, resource_type="video")
            return resource.get("secure_url")
            
        except Exception as e:
            # Removed verbose logging
            return None

# Global Cloudinary service instance
_cloudinary_service: Optional[CloudinaryService] = None

def get_cloudinary_service() -> CloudinaryService:
    """Get or create Cloudinary service instance."""
    global _cloudinary_service
    if _cloudinary_service is None:
        _cloudinary_service = CloudinaryService()
    return _cloudinary_service
