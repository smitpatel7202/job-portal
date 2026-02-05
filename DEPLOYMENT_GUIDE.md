# 🚀 Deployment Guide: Job Portal

## 📋 Prerequisites
- ✅ Cloudinary account configured
- ✅ Code updated for production
- ✅ GitHub repository created

## 🔧 Step 1: Get Your Cloudinary Cloud Name

1. Go to [cloudinary.com](https://cloudinary.com) and login
2. Navigate to Dashboard → Settings → Cloud
3. Copy your **Cloud Name** (it looks like: `abc123def`)
4. Update your `.env` file with:
   ```
   CLOUDINARY_CLOUD_NAME=your_actual_cloud_name
   ```

## 🌐 Step 2: Deploy Backend to Render

1. Go to [render.com](https://render.com)
2. Sign up and click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `job-portal-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`

5. Add Environment Variables:
   ```
   PORT=5000
   MONGO_URI=mongodb+srv://jobuser:jobportal123@cluster0.iatff3a.mongodb.net/?appName=Cluster0
   JWT_SECRET=your-super-secret-key-production-change-this
   JWT_REFRESH_SECRET=your-refresh-secret-different-from-above
   ACCESS_TOKEN_EXPIRES=1h
   REFRESH_TOKEN_EXPIRES=7d
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-gmail-app-password
   EMAIL_FROM="Job Portal <noreply@jobportal.com>"
   CLOUDINARY_CLOUD_NAME=your_actual_cloud_name
   CLOUDINARY_API_KEY=695694627327183
   CLOUDINARY_API_SECRET=P_ARGKQaSTz4vapsKGUysa1scNw
   NODE_ENV=production
   ```

6. Click "Create Web Service"
7. Wait for deployment (2-3 minutes)
8. Copy your Render URL: `https://your-app-name.onrender.com`

## 🎨 Step 3: Update Frontend Configuration

1. Edit `frontend/config.js`
2. Replace `your-backend-url.onrender.com` with your actual Render URL
3. Replace `your-frontend-domain.netlify.app` with your planned Netlify URL

## 🌍 Step 4: Deploy Frontend to Netlify

### Option A: Drag & Drop (Easiest)
1. Go to [netlify.com](https://netlify.com)
2. Drag the entire `frontend` folder to the deploy area
3. Your site will be live instantly!

### Option B: GitHub Integration (Recommended)
1. In Netlify, click "New site from Git"
2. Connect your GitHub repository
3. Configure:
   - **Build command**: Leave blank (static site)
   - **Publish directory**: `frontend`
4. Deploy

## 🔧 Step 5: Final Updates

1. Update CORS in your backend:
   - Go to your Render service
   - Environment Variables
   - Update `CORS_ORIGIN` to your Netlify URL

2. Update frontend config:
   - Edit `frontend/config.js`
   - Replace placeholder URLs with actual URLs

## ✅ Step 6: Test Everything

1. **Backend Test**: Visit `https://your-backend.onrender.com/api/health`
2. **Frontend Test**: Visit your Netlify site
3. **File Upload Test**: Upload a resume/profile picture
4. **User Registration Test**: Create new accounts
5. **Job Posting Test**: Post a job as employer

## 🎯 Production URLs Structure

- **Frontend**: `https://your-site.netlify.app`
- **Backend API**: `https://your-backend.onrender.com/api`
- **File Storage**: Cloudinary CDN (automatic)

## 🔥 Important Notes

### Free Tier Limitations:
- **Render**: 750 hours/month, sleeps after 15min inactivity
- **Netlify**: Unlimited bandwidth, 100GB build minutes
- **Cloudinary**: 25GB storage, 25GB bandwidth/month
- **MongoDB Atlas**: 512MB storage

### To Keep Your Site Active:
- Render will sleep after 15 minutes of inactivity
- First visit after sleep may take 30-60 seconds to load
- Subsequent visits will be fast until next sleep period

### Security:
- Your `.env` file should NEVER be committed to Git
- All API keys are safely stored in environment variables
- CORS is configured to only allow your frontend domain

## 🎉 You're Live!

Your job portal is now live with:
- ✅ Professional file storage via Cloudinary
- ✅ Scalable backend on Render
- ✅ Fast frontend on Netlify
- ✅ Secure database on MongoDB Atlas
- ✅ SSL certificates included
- ✅ Custom domain support (optional)

## 🛠️ Next Steps (Optional)

1. **Custom Domain**: Add custom domain in Netlify settings
2. **Email Service**: Configure SendGrid for better email delivery
3. **Monitoring**: Add uptime monitoring
4. **Analytics**: Add Google Analytics
5. **SEO**: Optimize meta tags and sitemaps
