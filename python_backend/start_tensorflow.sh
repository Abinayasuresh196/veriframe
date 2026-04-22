#!/bin/bash
# TensorFlow-optimized startup script for Render free tier

# Set TensorFlow memory optimizations
export TF_CPP_MIN_LOG_LEVEL="3"  # Reduce TensorFlow logging
export TF_FORCE_GPU_ALLOW_GROWTH="true"  # Allow GPU memory growth
export TF_ALLOCATOR="cpu"  # Force CPU allocation on free tier

# Limit TensorFlow threads to reduce memory usage
export OMP_NUM_THREADS=1
export TF_NUM_INTEROP_THREADS=1
export TF_INTRA_OP_PARALLELISM_THREADS=1

# Python memory optimizations
export PYTHONUNBUFFERED=1
export PYTHONDONTWRITEBYTECODE=1

# Ensure FFmpeg is available
export PATH="/usr/local/bin:$PATH"

echo "🚀 Starting TensorFlow-optimized backend..."

# Start the FastAPI app
uvicorn app.main:app --host 0.0.0.0 --port $PORT
