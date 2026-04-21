# VeriFrame - Setup Guide

This guide will help you set up VeriFrame on your laptop or another device.

## System Requirements

- **Python**: 3.10 or higher (tested with Python 3.10+)
- **Node.js**: 20 or higher (tested with Node 20.x)
- **FFmpeg**: Required for video processing
- **Git**: Optional (for cloning repository)
- **Operating System**: Windows, macOS, or Linux

## Prerequisites Installation

### 1. Install Python

**Windows:**
- Download from [python.org](https://www.python.org/downloads/)
- During installation, check "Add Python to PATH"

**macOS:**
```bash
brew install python@3.10
```

**Linux:**
```bash
sudo apt update
sudo apt install python3.10 python3-pip
```

**Verify installation:**
```bash
python --version
pip --version
```

### 2. Install Node.js

**Windows/macOS:**
- Download from [nodejs.org](https://nodejs.org/)

**Linux:**
```bash
sudo apt install nodejs npm
```

**Verify installation:**
```bash
node --version
npm --version
```

### 3. Install FFmpeg

**Windows:**
- Download from [ffmpeg.org](https://ffmpeg.org/download.html)
- Add FFmpeg to system PATH

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

**Verify installation:**
```bash
ffmpeg -version
```

## External Services Setup

### 1. MongoDB Atlas (Free Tier)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account
3. Create a new cluster (M0 Sandbox - Free)
4. Create a database user:
   - Username: Your choice
   - Password: Your choice (save this!)
5. Network Access: Allow access from anywhere (0.0.0.0/0)
6. Get connection string:
   - Click "Connect" → "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database password

### 2. Cloudinary (Free Tier)

1. Go to [Cloudinary](https://cloudinary.com/)
2. Create a free account
3. Navigate to Dashboard
4. Copy:
   - Cloud name
   - API Key
   - API Secret

## Installation Steps

### 1. Extract the ZIP File

Extract the VeriFrame zip file to your desired location.

### 2. Install Python Dependencies

```bash
cd python_backend
pip install -r requirements.txt
```

### 3. Install Node.js Dependencies

```bash
cd src/frontend
npm install
```

### 4. Configure Environment Variables

1. Copy the example environment file:
```bash
# From project root
cp .env.example .env
```

2. Edit `.env` file with your credentials:

```env
# MongoDB Atlas Connection
MONGODB_CONNECTION_STRING=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/veriframedb?retryWrites=true&w=majority
MONGODB_DATABASE_NAME=veriframedb

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=YOUR_CLOUD_NAME
CLOUDINARY_API_KEY=YOUR_API_KEY
CLOUDINARY_API_SECRET=YOUR_API_SECRET
CLOUDINARY_UPLOAD_PRESET=veriframe_videos
```

## Running the Application

### Start Backend Server

```bash
cd python_backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: `http://localhost:8000`

### Start Frontend Server

Open a new terminal:

```bash
cd src/frontend
npm run dev
```

Frontend will be available at: `http://localhost:5173`

## Accessing the Application

1. Open your browser
2. Navigate to `http://localhost:5173`
3. You can register a new account or use demo credentials:
   - Username: `demo`
   - Password: `demo`

## Troubleshooting

### Backend Issues

**Port 8000 already in use:**
```bash
# Use a different port
python -m uvicorn app.main:app --reload --port 8001
```

**MongoDB connection failed:**
- Verify your connection string in `.env`
- Check network access in MongoDB Atlas (IP whitelist)
- Ensure database user has correct permissions

**Module not found:**
```bash
# Reinstall Python dependencies
pip install -r requirements.txt
```

### Frontend Issues

**Port 5173 already in use:**
```bash
# Use a different port
npm run dev -- --port 5174
```

**npm install failed:**
```bash
# Clear cache and retry
npm cache clean --force
npm install
```

### FFmpeg Issues

**FFmpeg not found:**
- Ensure FFmpeg is installed and added to system PATH
- Verify installation with `ffmpeg -version`

## Project Structure

```
veriframe/
├── python_backend/          # Backend API (FastAPI)
│   ├── app/
│   │   ├── main.py         # Main application
│   │   ├── mongodb.py      # MongoDB connection
│   │   ├── auth_mongodb.py # Authentication
│   │   └── analysis_mongodb.py # Analysis logic
│   └── requirements.txt    # Python dependencies
├── src/frontend/           # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── routes/        # Page routes
│   │   └── lib/           # Utilities
│   └── package.json       # Node.js dependencies
├── .env.example           # Environment template
├── .env                   # Your credentials (DO NOT SHARE)
└── SETUP.md              # This file
```

## Security Notes

- **Never share your `.env` file** - it contains sensitive credentials
- Use strong passwords for MongoDB and Cloudinary
- Keep your dependencies updated regularly
- In production, use environment variables instead of `.env` file

## Support

If you encounter issues:

1. Check the terminal logs for error messages
2. Verify all prerequisites are installed correctly
3. Ensure external services (MongoDB Atlas, Cloudinary) are accessible
4. Check that your `.env` file is configured correctly

## Demo Video

The application includes a demo video for testing. If the demo video is missing, you can upload your own video to test the deepfake detection features.

## Features

- **User Authentication**: Register, login, and manage your account
- **Video Analysis**: Upload videos for deepfake detection
- **Analysis History**: View your past analysis results
- **Share Reports**: Generate shareable links for analysis results
- **Real-time Processing**: Fast video analysis with forensic breakdown

---

**Enjoy using VeriFrame! 🎬**
