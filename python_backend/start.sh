#!/bin/bash
# Ensure FFmpeg is available on Render
export PATH="/usr/local/bin:$PATH"
uvicorn app.main:app --host 0.0.0.0 --port $PORT
