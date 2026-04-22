#!/usr/bin/env python3
"""
Test script to verify frame analysis is working correctly
"""

import os
import sys
import cv2
import numpy as np

# Add the app directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from deepfake_model import get_deepfake_model

def test_frame_analysis():
    """Test the frame analysis with a simple video."""
    print("=== Frame Analysis Test ===")
    
    # Get the model
    model = get_deepfake_model()
    print(f"Model available: {model.is_available()}")
    
    if not model.is_available():
        print("❌ Model not available")
        return False
    
    # Create a simple test video (if needed)
    test_video_path = "test_video.mp4"
    
    # For now, let's test with a simple frame prediction
    print("Testing single frame prediction...")
    
    # Create a test frame (48x48 RGB)
    test_frame = np.random.randint(0, 255, (48, 48, 3), dtype=np.uint8)
    
    try:
        prediction = model.predict_frame(test_frame)
        print(f"✅ Single frame prediction successful: {prediction}")
    except Exception as e:
        print(f"❌ Single frame prediction failed: {e}")
        return False
    
    print("✅ Frame analysis test completed successfully")
    return True

if __name__ == "__main__":
    success = test_frame_analysis()
    sys.exit(0 if success else 1)
