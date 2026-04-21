# 🚀 VeriFrame Deployment Guide (Render + Vercel)

This guide provides step-by-step instructions to deploy VeriFrame with full compatibility and all functionalities.

## **Recommended Stack**

- **Backend**: Render (Python/FastAPI)
- **Frontend**: Vercel (React/Vite)
- **Database**: MongoDB Atlas (already cloud-based)
- **Storage**: Cloudinary (already cloud-based)

---

## **Pre-Deployment Checklist**

### **1. Prepare Your Code**

#### **Backend (python_backend/)**
- ✅ Ensure `requirements.txt` is up to date
- ✅ Create `Procfile` for Render
- ✅ Verify `.env.example` exists
- ✅ Test backend locally: `python -m uvicorn app.main:app --reload`

#### **Frontend (src/frontend/)**
- ✅ Ensure `package.json` is complete
- ✅ Create `.env.local` for local testing
- ✅ Test frontend locally: `npm run dev`
- ✅ Build locally: `npm run build`

### **2. Create Required Accounts**

- [ ] GitHub account (push code to GitHub)
- [ ] Render account (render.com)
- [ ] Vercel account (vercel.com)
- [ ] MongoDB Atlas account (already have)
- [ ] Cloudinary account (already have)

---

## **Step 1: Push Code to GitHub**

### **Initialize Git (if not already done)**
```bash
cd d:\veriframe
git init
git add .
git commit -m "Initial commit for deployment"
```

### **Create GitHub Repository**
1. Go to github.com and create a new repository
2. Push your code:
```bash
git remote add origin https://github.com/your-username/veriframe.git
git branch -M main
git push -u origin main
```

---

## **Step 2: Backend Deployment on Render**

### **2.1 Create Procfile**

Create `python_backend/Procfile`:
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### **2.2 Deploy to Render**

1. **Sign up/Login to Render**
   - Go to https://render.com
   - Sign up with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Select your `veriframe` repository
   - Select branch: `main`

3. **Configure Build & Runtime**
   - **Root Directory**: `python_backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

4. **Configure Environment Variables**
   Add these in the "Environment" section:
   
   ```
   MONGODB_CONNECTION_STRING=mongodb+srv://your-username:your-password@cluster0.xxx.mongodb.net/veriframedb?retryWrites=true&w=majority
   MONGODB_DATABASE_NAME=veriframedb
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

5. **Advanced Settings**
   - **Instance Type**: Free (or Standard for better performance)
   - **Region**: Choose region closest to your users
   - **Auto-Deploy**: Enable (deploys on git push)

6. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (2-5 minutes)
   - Copy your backend URL: `https://your-app.onrender.com`

7. **Verify Backend**
   - Check the Render dashboard for status
   - Test health endpoint: `https://your-app.onrender.com/health`
   - Check logs for any errors

---

## **Step 3: Frontend Deployment on Vercel**

### **3.1 Configure Environment Variables**

Create `src/frontend/.env.production`:
```
VITE_API_URL=https://your-app.onrender.com
```

### **3.2 Deploy to Vercel**

1. **Sign up/Login to Vercel**
   - Go to https://vercel.com
   - Sign up with GitHub

2. **Import Project**
   - Click "Add New" → "Project"
   - Select your `veriframe` repository
   - Click "Import"

3. **Configure Project Settings**
   - **Framework Preset**: Vite
   - **Root Directory**: `src/frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

4. **Add Environment Variables**
   In "Environment Variables" section:
   ```
   VITE_API_URL=https://your-app.onrender.com
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait for deployment (1-2 minutes)
   - Copy your frontend URL: `https://your-app.vercel.app`

6. **Verify Frontend**
   - Open your Vercel URL
   - Test login functionality
   - Test video upload

---

## **Step 4: Configure CORS**

### **Update Backend CORS Settings**

Edit `python_backend/app/main.py`:

```python
# Find the CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://your-app.vercel.app",  # Add your Vercel URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### **Push CORS Update**
```bash
git add python_backend/app/main.py
git commit -m "Update CORS for production"
git push
```

Render will auto-redeploy with the new CORS settings.

---

## **Step 5: Configure FFmpeg on Render**

### **Install FFmpeg (Render Native)**

Render comes with FFmpeg pre-installed, but we need to ensure it's in PATH.

Create `python_backend/start.sh`:
```bash
#!/bin/bash
# Ensure FFmpeg is available
export PATH="/usr/local/bin:$PATH"
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Update `Procfile`:
```
web: bash start.sh
```

Make `start.sh` executable:
```bash
chmod +x python_backend/start.sh
```

Push changes:
```bash
git add python_backend/start.sh python_backend/Procfile
git commit -m "Add FFmpeg support for Render"
git push
```

---

## **Step 6: Post-Deployment Testing**

### **Test Backend Endpoints**

```bash
# Health check
curl https://your-app.onrender.com/health

# Login test
curl -X POST https://your-app.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo"}'
```

### **Test Frontend**

1. **Open Vercel URL**
2. **Login with demo/demo**
3. **Upload a test video**
4. **Check analysis results**
5. **Verify frame display from Cloudinary**

---

## **Step 7: Configure Domain (Optional)**

### **Frontend Custom Domain**

1. In Vercel dashboard → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update CORS in backend with new domain

### **Backend Custom Domain**

1. In Render dashboard → Settings → Custom Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update frontend `.env.production` with new backend URL

---

## **Troubleshooting**

### **Backend Issues**

**Issue: Build fails on Render**
- Check Render logs for specific error
- Ensure all dependencies are in `requirements.txt`
- Verify Python version compatibility

**Issue: FFmpeg not found**
- Ensure `start.sh` is executable
- Check Render logs for FFmpeg errors
- Use the native Render FFmpeg path

**Issue: MongoDB connection failed**
- Verify connection string in Render environment variables
- Check MongoDB Atlas IP whitelist (allow Render IP)
- Ensure database user has correct permissions

### **Frontend Issues**

**Issue: API requests failing**
- Check browser console for CORS errors
- Verify `VITE_API_URL` is correct
- Ensure backend CORS includes Vercel domain

**Issue: Video upload fails**
- Check Cloudinary configuration
- Verify file size limits
- Check backend logs for upload errors

### **Common Issues**

**Issue: Slow video processing**
- This is expected due to FFmpeg conversion + Cloudinary uploads
- Consider upgrading to paid Render tier for better performance
- Reduce number of frames analyzed if needed

**Issue: Frames not displaying**
- Verify Cloudinary API keys are correct
- Check if frames are being uploaded to Cloudinary
- Ensure Cloudinary folder exists

---

## **Maintenance**

### **Regular Updates**

- Keep dependencies updated
- Monitor Render logs for errors
- Check Vercel deployment status
- Monitor MongoDB Atlas storage usage
- Monitor Cloudinary bandwidth usage

### **Backup Strategy**

- MongoDB Atlas has automatic backups (paid plans)
- Export important data regularly
- Keep local copy of configuration files

---

## **Cost Estimation**

### **Free Tier (Development)**
- Render: Free (512MB RAM, 0.1 CPU)
- Vercel: Free (100GB bandwidth)
- MongoDB Atlas: Free (512MB storage)
- Cloudinary: Free (25GB storage, 25GB bandwidth)

### **Paid Tier (Production)**
- Render: $7/month (Standard)
- Vercel: $20/month (Pro)
- MongoDB Atlas: $9/month (M10)
- Cloudinary: $89/month (Basic)

---

## **Support**

For deployment issues:
- Render Dashboard: Check logs
- Vercel Dashboard: Check deployment logs
- MongoDB Atlas: Check connection logs
- Cloudinary: Check upload logs

---

## **Next Steps**

1. Follow this guide step-by-step
2. Test all functionalities after deployment
3. Monitor performance and logs
4. Set up alerts for errors
5. Plan for scaling if needed

**Your VeriFrame application is now production-ready!** 🚀
