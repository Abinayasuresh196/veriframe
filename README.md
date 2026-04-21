# VeriFrame - Professional Video Authenticity Detection Platform

VeriFrame is a state-of-the-art video forensics platform that uses advanced deep learning to detect deepfakes and manipulated video content. Upload any video and receive comprehensive analysis including authenticity scores, deepfake probability, frame-level heatmaps, and temporal inconsistency detection.

## 🌟 Features

- **Real-time Video Analysis**: Upload videos and get instant deepfake detection results
- **Deepfake Probability Score**: AI-powered analysis using trained neural networks
- **Frame-level Analysis**: Detailed examination of individual video frames
- **Temporal Consistency Detection**: Identifies temporal inconsistencies across video timeline
- **Visual Heatmaps**: Frame-by-frame forensic visualization
- **Analysis History**: Complete history of all analyzed videos
- **Shareable Reports**: Generate shareable links for analysis results
- **PDF Reports**: Download detailed forensic analysis reports
- **User Authentication**: Secure user registration and login system
- **MongoDB Cloud Storage**: Persistent storage using MongoDB Atlas
- **Cloudinary Integration**: Secure video and frame storage in the cloud

## 🛠 Tech Stack

### Frontend
- **React 19** - Modern React framework
- **TypeScript** - Type-safe development
- **TailwindCSS** - Utility-first CSS framework
- **shadcn/ui** - Beautiful UI components
- **TanStack Router** - Modern routing solution
- **Zustand** - State management
- **Recharts** - Data visualization

### Backend
- **FastAPI** - Modern, fast web framework for building APIs
- **Python 3.10+** - Programming language
- **OpenCV** - Computer vision and video processing
- **NumPy** - Numerical computing for statistical analysis
- **MongoDB Atlas** - Cloud database for persistent storage
- **Cloudinary** - Cloud media management
- **Motor** - Async MongoDB driver

### Deepfake Detection
- **Distribution-based Verdict Logic** - Statistical analysis using min-max normalization
- **Frame-level Analysis** - Detailed examination of individual video frames
- **Confidence Scoring** - Probability-based authenticity assessment
- **Multi-dataset Training** - Trained on FaceForensics++, Celeb-DF v2, and DeepFake Detection Dataset

### Model Training
- **Final Accuracy**: 85.13% (0.8513)
- **Training Datasets**:
  - **FaceForensics++**: Base dataset with multiple fake types (Deepfakes, Face2Face, FaceSwap, NeuralTextures)
  - **Celeb-DF v2**: High-quality realistic deepfakes
  - **DeepFake Detection Dataset (DFD)**: Real-world style dataset for diversity
- **Training Approach**: Multi-dataset training to reduce overfitting and improve robustness across different deepfake generation methods

## 📋 Prerequisites

Before setting up VeriFrame on a new device, ensure you have:

### Required Software
- **Node.js 20+** - JavaScript runtime
- **Python 3.10+** - Python interpreter
- **FFmpeg** - Video processing (required)
- **Git** - Version control (optional)

### Required Accounts
- **MongoDB Atlas Account** - Free tier available at [mongodb.com](https://www.mongodb.com/cloud/atlas)
- **Cloudinary Account** - Free tier available at [cloudinary.com](https://cloudinary.com)

### Optional Software
- **VS Code** - Recommended IDE with extensions for React, Python, and TypeScript

## 🚀 Setup Instructions for New Devices

### Step 1: Get the Project Files

**Option A: Clone from Git Repository (if you have remote repository)**
```bash
git clone <your-repository-url>
cd veriframe
```

**Option B: Extract from ZIP File (if you received a zip file)**
```bash
# Extract the zip file
# Windows: Right-click → Extract All
# Or use PowerShell:
Expand-Archive -Path veriframe.zip -DestinationPath .

# Navigate to extracted directory
cd veriframe
```

**Option C: Use Existing Files (if you already have the project)**
- Navigate to the project directory: `cd veriframe`
- Skip to Step 2

### Step 2: Install Node.js Dependencies

```bash
# Install frontend dependencies
cd src/frontend
npm install
cd ../..
```

### Step 3: Set Up MongoDB Atlas

1. **Create MongoDB Atlas Account:**
   - Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
   - Sign up for free account
   - Create a new project

2. **Create Cluster:**
   - Click "Build a Database"
   - Select "M0 Sandbox" (free tier)
   - Choose a region close to your location
   - Name your cluster (e.g., "veriframe-cluster")
   - Click "Create"

3. **Configure Database Access:**
   - Go to "Database Access" → "Add New Database User"
   - Username: `veriframe_user` (or your preferred username)
   - Password: Generate a strong password
   - Save the connection string (you'll need it later)

4. **Configure Network Access:**
   - Go to "Network Access" → "Add IP Address"
   - Select "Allow Access from Anywhere" (for development)
   - Or add your specific IP address

5. **Get Connection String:**
   - Go to "Database" → "Connect" → "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your actual password

### Step 4: Set Up Cloudinary

1. **Create Cloudinary Account:**
   - Go to [cloudinary.com](https://cloudinary.com)
   - Sign up for free account

2. **Get API Credentials:**
   - Go to Dashboard → "API Keys"
   - Copy:
     - Cloud Name
     - API Key
     - API Secret

### Step 5: Configure Environment Variables

Create a `.env` file in `python_backend/` directory:

```bash
cd python_backend
```

Create `.env` file with the following content:

```env
# MongoDB Configuration
MONGODB_CONNECTION_STRING=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/veriframedb?retryWrites=true&w=majority
MONGODB_DATABASE_NAME=veriframedb

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>
CLOUDINARY_UPLOAD_PRESET=unsigned_uploads

# App Configuration
APP_NAME=VeriFrame
APP_HOST=0.0.0.0
APP_PORT=8000
```

### Step 6: Set Up Python Virtual Environment

```bash
# Create virtual environment in short path (avoids Windows Long Path issues)
python -m venv C:\venv

# Activate virtual environment
C:\venv\Scripts\activate

# Navigate to python_backend
cd python_backend
```

### Step 7: Install Python Dependencies

```bash
# Install required packages
pip install -r requirements.txt
```

The requirements.txt includes:
- fastapi>=0.115.0
- uvicorn[standard]>=0.34.0
- pydantic>=2.11.0
- pydantic-settings>=2.8.0
- python-multipart>=0.0.20
- python-dotenv>=1.0.0
- motor>=3.5.0
- pymongo>=4.5.0
- dnspython>=2.6.0
- cloudinary>=1.41.0
- opencv-python>=4.10.0
- onnxruntime>=1.18.0
- numpy>=1.24.0

### Step 8: Configure Frontend Environment

Create `.env.local` in `src/frontend/` directory:

```bash
cd src/frontend
```

Create `.env.local` file:

```env
VITE_USE_PYTHON_BACKEND=true
VITE_PYTHON_BACKEND_URL=http://127.0.0.1:8000
VITE_BASE_URL=
```

### Step 9: Start the Backend

```bash
# Activate virtual environment (if not already active)
C:\venv\Scripts\activate

# Navigate to python_backend
cd python_backend

# Start the FastAPI server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will start on `http://0.0.0.0:8000`

### Step 10: Start the Frontend

```bash
# Open new terminal
cd src/frontend

# Start the development server
npm run dev
```

The frontend will start on `http://localhost:5173`

## 🎯 Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
C:\venv\Scripts\activate
cd python_backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 - Frontend:**
```bash
cd src/frontend
npm run dev
```

**Access the application:** Open http://localhost:5173 in your browser

### Default Credentials

**Demo User:**
- Username: `demo`
- Password: `demo`

**Or register a new user through the application**

## 📁 Project Structure

```
veriframe/
├── src/
│   └── frontend/              # React frontend
│       ├── src/
│       │   ├── components/     # React components
│       │   ├── routes/        # Page routes
│       │   ├── lib/           # Utility functions
│       │   └── App.tsx        # Main application
│       ├── public/            # Static assets
│       ├── package.json       # Frontend dependencies
│       ├── tsconfig.json      # TypeScript config
│       └── tailwind.config.js # TailwindCSS config
├── python_backend/            # Python FastAPI backend
│   ├── app/
│   │   ├── main.py           # FastAPI application entry point
│   │   ├── auth_mongodb.py   # MongoDB authentication
│   │   ├── analysis_mongodb.py # Analysis management
│   │   ├── mongodb.py        # MongoDB connection
│   │   ├── cloudinary_service.py # Cloudinary integration
│   │   ├── deepfake_model.py # Deepfake detection model
│   │   ├── frame_extractor.py # Video frame extraction
│   │   ├── db.py             # Local storage fallback
│   │   └── models.py         # Pydantic models
│   ├── requirements.txt      # Python dependencies
│   └── .env                 # Environment variables
├── SETUP.md                 # Setup guide for new devices
└── README.md               # This file
```

## 🔧 Configuration

### Backend Configuration (.env)

```env
# MongoDB
MONGODB_CONNECTION_STRING=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
MONGODB_DATABASE_NAME=veriframedb

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_UPLOAD_PRESET=unsigned_uploads

# App
APP_NAME=VeriFrame
APP_HOST=0.0.0.0
APP_PORT=8000
```

### Frontend Configuration (.env.local)

```env
VITE_USE_PYTHON_BACKEND=true
VITE_PYTHON_BACKEND_URL=http://127.0.0.1:8000
VITE_BASE_URL=
```

## 🧪 Testing

### Test Backend API

```bash
# Test health endpoint
curl http://localhost:8000/

# Test user registration
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass", "email": "test@example.com"}'

# Test user login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "demo", "password": "demo"}'
```

### Test Frontend

Open http://localhost:5173 in your browser and:
1. Register a new account or login with demo credentials
2. Upload a video file
3. View the analysis results
4. Check your analysis history

## 🐛 Troubleshooting

### Common Issues

**Issue: Backend won't start - MongoDB connection error**
- Solution: Check your MongoDB connection string in `.env` file
- Ensure MongoDB Atlas IP whitelist includes your IP address

**Issue: Video upload fails**
- Solution: Check Cloudinary credentials in `.env` file
- Ensure Cloudinary upload preset is configured

**Issue: Frontend can't connect to backend**
- Solution: Ensure backend is running on port 8000
- Check `VITE_PYTHON_BACKEND_URL` in `.env.local`

**Issue: Windows Long Path errors during installation**
- Solution: Use short-path virtual environment: `python -m venv C:\venv`
- Activate: `C:\venv\Scripts\activate`

**Issue: Port already in use**
- Solution: Change port in startup command: `--port 8001`
- Or kill process using the port: `taskkill /PID <pid> /F`

**Issue: FFmpeg not found**
- Solution: Ensure FFmpeg is installed and added to system PATH
- Verify installation with `ffmpeg -version`

## 📊 API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user

### Analysis
- `POST /analyze` - Submit video for analysis
- `GET /analysis/{analysis_id}` - Get analysis results
- `GET /analysis` - Get user analysis history
- `DELETE /analysis/{analysis_id}` - Delete analysis

### Health
- `GET /` - Health check endpoint

## 🔐 Security

- Passwords are hashed using SHA-256 with username salt
- MongoDB Atlas uses SSL/TLS encryption
- Cloudinary uses signed URLs for media access
- API endpoints require authentication
- User data is isolated by user ID

## 📈 Performance

- **Video Processing**: Optimized frame extraction using OpenCV and FFmpeg
- **Deepfake Detection**: ONNX Runtime for fast model inference
- **Statistical Analysis**: NumPy for efficient numerical computing
- **Database**: MongoDB Atlas with automatic indexing
- **Storage**: Cloudinary CDN for fast media delivery
- **Frontend**: React with efficient state management

## 🚀 Deployment

### Backend Deployment

1. **Deploy to Cloud Service:**
   - AWS, Google Cloud, Azure, or Heroku
   - Set environment variables
   - Install dependencies
   - Start with gunicorn: `gunicorn app.main:app`

2. **Configure Production:**
   - Use production MongoDB Atlas cluster
   - Set up Cloudinary production environment
   - Enable HTTPS
   - Configure CORS for production domain

### Frontend Deployment

1. **Build for Production:**
   ```bash
   cd src/frontend
   npm run build
   ```

2. **Deploy to Static Hosting:**
   - Vercel, Netlify, or AWS S3
   - Configure environment variables
   - Set up custom domain

## 📝 License

This project is proprietary software. All rights reserved.

## 🤝 Support

For issues and questions:
- Check the troubleshooting section
- Review MongoDB Atlas and Cloudinary documentation
- Ensure all prerequisites are installed correctly

## 🎓 Acknowledgments

- TensorFlow for ML framework
- MongoDB Atlas for cloud database
- Cloudinary for media management
- shadcn/ui for UI components
- The open-source community

---

**VeriFrame** - Professional Video Authenticity Detection Platform
