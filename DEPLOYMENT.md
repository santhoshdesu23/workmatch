# WorkMatch — GitHub & Vercel Deployment Guide

This guide provides step-by-step instructions to push your repository to GitHub and deploy the application live on Vercel.

---

## 1. Push to GitHub

### Step A: Create a New Repository on GitHub
1. Go to [https://github.com/new](https://github.com/new).
2. Enter Repository name: `workmatch` (or your preferred name).
3. Choose **Public** or **Private**.
4. **Do NOT check** "Initialize with README", `.gitignore`, or license (we already have them set up).
5. Click **Create repository**.

### Step B: Connect and Push Your Code
Open your terminal in `c:\Users\santh\.antigravity-ide\work match` and run:

```bash
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPOSITORY_NAME>.git
git push -u origin main
```

*(Replace `<YOUR_GITHUB_USERNAME>` and `<YOUR_REPOSITORY_NAME>` with your actual GitHub repository URL).*

> **Security Note:** Your `.env` files are protected by `.gitignore` and are **not** committed or exposed to GitHub.

---

## 2. Deploy on Vercel

The repository is pre-configured with a full-stack [`vercel.json`](./vercel.json) and [`api/index.js`](./api/index.js) serverless handler.

### Step A: Import into Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** → **Project**.
3. Import your GitHub repository (`workmatch`).
4. Keep the **Root Directory** as `./` (or default).
5. Framework Preset: **Vite** (Vercel detects this automatically).

### Step B: Add Environment Variables in Vercel
Before clicking Deploy, expand **Environment Variables** in Vercel and add:

| Key | Value | Description |
|---|---|---|
| `MONGODB_URI` | `your_mongodb_atlas_connection_string` | Your live MongoDB Atlas Cluster |
| `JWT_SECRET` | `your_jwt_secret_key` | Token encryption secret |
| `GEMINI_API_KEY` | `your_gemini_api_key` | Google Gemini AI Key |
| `NODE_ENV` | `production` | Production mode |

### Step C: Deploy
1. Click **Deploy**.
2. Vercel will install dependencies, build the React frontend with Vite, bundle the serverless `/api` routes, and provide your live production URL (e.g., `https://workmatch-app.vercel.app`).
