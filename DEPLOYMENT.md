# Deployment Guide

This guide will help you deploy the Task Management Tool to Vercel (frontend) and Render (backend).

## Prerequisites

- GitHub repository with your code
- Vercel account (free tier available)
- Render account (free tier available)

## Step 1: Deploy Backend to Render

### 1.1 Create Render Account
- Go to [render.com](https://render.com)
- Sign up with your GitHub account

### 1.2 Create New Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure the service:
   - **Name**: `task-management-backend` (or your preferred name)
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid if needed)

### 1.3 Environment Variables
- `NODE_ENV`: `production`
- `PORT`: Render sets this automatically
- `DATABASE_URL`: Your PostgreSQL connection string (see Step 1.4 below)
- `JWT_SECRET`: A secure random string for JWT token signing (generate a strong secret)
- `FRONTEND_URL`: Your Vercel frontend URL (e.g., `https://your-project-name.vercel.app`)

### 1.4 Set Up PostgreSQL Database
1. In your Render dashboard, click "New +" → "PostgreSQL"
2. Configure the database:
   - **Name**: `task-management-db` (or your preferred name)
   - **Database**: `taskmanagement`
   - **User**: `postgres` (or custom username)
   - **Plan**: Free (or paid if needed)
3. Click "Create Database"
4. Copy the **Internal Database URL** from the database dashboard
5. Go back to your web service and add the environment variable:
   - **Name**: `DATABASE_URL`
   - **Value**: Paste the Internal Database URL you copied

### 1.5 Generate JWT Secret
Generate a secure JWT secret for production:
```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Option 2: Using OpenSSL
openssl rand -hex 64

# Option 3: Online generator (less secure)
# Visit: https://generate-secret.vercel.app/64
```

Add the generated secret as the `JWT_SECRET` environment variable in your Render service.

### 1.6 Deploy
- Click "Create Web Service"
- Render will automatically deploy your backend
- Note the URL: `https://your-app-name.onrender.com`

## Step 2: Deploy Frontend to Vercel

### 2.1 Create Vercel Account
- Go to [vercel.com](https://vercel.com)
- Sign up with your GitHub account

### 2.2 Import Project
1. Click "New Project"
2. Import your GitHub repository
3. Configure the project:
   - **Framework Preset**: `Create React App`
   - **Root Directory**: `client`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `build` (auto-detected)

### 2.3 Environment Variables
Add the following environment variable:
- **Name**: `REACT_APP_API_URL`
- **Value**: `https://your-app-name.onrender.com/api`
  (Replace with your actual Render backend URL)

### 2.4 Deploy
- Click "Deploy"
- Vercel will automatically deploy your frontend
- Your app will be available at: `https://your-project-name.vercel.app`

## Step 3: Test Your Deployment

### 3.1 Test Backend
- Visit your Render URL: `https://your-app-name.onrender.com/api/workspaces`
- You should see an empty array `[]` (no workspaces yet)

### 3.2 Test Frontend
- Visit your Vercel URL
- The app should load and automatically create a default workspace
- Try creating a task to test the full functionality

## Step 4: Update Environment Variables (if needed)

If you need to change the backend URL:

### Vercel Dashboard
1. Go to your project dashboard
2. Click "Settings" → "Environment Variables"
3. Update `REACT_APP_API_URL` with the new backend URL
4. Redeploy the project

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - The backend already has CORS configured for all origins
   - If you see CORS errors, check that the API URL is correct

2. **Database Issues**
   - The app now uses PostgreSQL which provides data persistence
   - Ensure the `DATABASE_URL` environment variable is set correctly
   - Check that the database service is running and accessible

3. **Build Failures**
   - Check that all dependencies are in `package.json`
   - Ensure Node.js version is compatible (v14+)

4. **API Connection Issues**
   - Verify the `REACT_APP_API_URL` environment variable is set correctly
   - Check that the backend is running and accessible
   - Ensure `JWT_SECRET` is set for authentication
   - Verify `FRONTEND_URL` is set correctly for CORS

### Performance Considerations

1. **Free Tier Limitations**
   - Render free tier: 750 hours/month, spins down after 15 minutes of inactivity
   - Vercel free tier: 100GB bandwidth/month, 100 serverless function executions/day

2. **Database Persistence**
   - PostgreSQL on Render provides persistent storage
   - Data will persist between deployments and restarts
   - Consider upgrading to paid plans for better performance

## Production Considerations

### Security
- Add authentication if needed
- Consider rate limiting
- Use HTTPS (provided by both platforms)

### Monitoring
- Set up logging and monitoring
- Configure error tracking (Sentry, etc.)

### Scaling
- Upgrade to paid plans for better performance
- Consider CDN for static assets
- Implement caching strategies

## Support

- **Vercel Documentation**: [vercel.com/docs](https://vercel.com/docs)
- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **GitHub Issues**: Create issues in your repository for code-specific problems 