# 🚀 Quick Deploy Guide

## Deploy to Render.com in 5 Minutes

### 1. Prepare Your Repository
```bash
# Make sure your code is committed
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Deploy to Render
1. Go to https://render.com/
2. Sign up/Login (free account)
3. Click **"New +"** → **"Web Service"**
4. Connect your GitHub/GitLab account
5. Select this repository
6. Use these settings:
   - **Name**: `adyen-report-downloader`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

### 3. Add Environment Variable
1. In Render dashboard, go to **"Environment"** tab
2. Add variable:
   - **Key**: `ENCRYPTION_KEY`
   - **Value**: Run this command to generate:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - Copy the output and paste as the value

### 4. Deploy!
- Click **"Create Web Service"**
- Wait 2-3 minutes for deployment
- Your app will be live at: `https://your-app-name.onrender.com`

---

## ⚠️ Important Notes

### Free Tier Limitations:
- App sleeps after 15 minutes of inactivity
- First request after sleep takes ~30 seconds to wake up
- 750 hours/month free (enough for testing)

### Security Warning:
- **This app has NO authentication**
- Anyone with the URL can access it
- **Do NOT deploy with real API keys** without adding security
- Consider adding IP whitelist or basic auth

### For Production Use:
1. Add authentication (see DEPLOYMENT_GUIDE.md)
2. Use paid tier for better performance
3. Add database for persistent storage
4. Implement rate limiting

---

## Alternative: Railway.app (Even Easier!)

1. Go to https://railway.app
2. Click **"Start a New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Add environment variable `ENCRYPTION_KEY`
6. Done! Auto-deploys on every push

---

## Testing Your Deployment

After deployment:
1. Visit your app URL
2. Upload an account structure JSON
3. Enter a test API key (30+ characters)
4. Try starting a download
5. Check the logs in your hosting dashboard

---

## Need Help?

- See full guide: `DEPLOYMENT_GUIDE.md`
- Check logs in your hosting platform dashboard
- Test locally first: `npm start`

Good luck! 🎉
