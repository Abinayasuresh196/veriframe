#!/bin/bash
# Optimized build script for Render free tier
echo "🚀 Starting optimized build for Render..."

# Clean package cache to reduce memory usage
pip cache purge

# Install dependencies with no-cache flag (critical for Render free tier)
echo "📦 Installing dependencies with --no-cache-dir..."
pip install --no-cache-dir --upgrade pip
pip install --no-cache-dir -r requirements.txt

# Verify ONNX Runtime is working
echo "🔍 Verifying ONNX Runtime installation..."
python -c "import onnxruntime as ort; print('✅ ONNX Runtime version:', ort.__version__)"

echo "✅ Build complete!"
