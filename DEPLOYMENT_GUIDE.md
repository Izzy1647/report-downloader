# Deployment Guide for Adyen Report Downloader

## Quick Deploy to Render.com (Recommended)

### Prerequisites
- Git repository (GitHub, GitLab, or Bitbucket)
- Render.com account (free)

### Step-by-Step Instructions

1. **Push your code to Git** (if not already done):
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Sign up for Render**: https://render.com

3. **Create a new Web Service**:
   - Click "New +" → "Web Service"
   - Connect your Git repository
   - Select your repository

4. **Configure the service**:
   - **Name**: `adyen-report-downloader`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. **Add Environment Variables**:
   - Click "Environment" tab
   - Add variable:
     - **Key**: `ENCRYPTION_KEY`
     - **Value**: Generate with command below
   
   Generate encryption key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

6. **Deploy**:
   - Click "Create Web Service"
   - Render will automatically build and deploy
   - You'll get a URL like: `https://adyen-report-downloader.onrender.com`

### Post-Deployment

- Access your app at the provided URL
- Test API key storage and download functionality
- Monitor logs in Render dashboard

---

## Alternative: Deploy to Railway.app

### Step-by-Step Instructions

1. **Sign up for Railway**: https://railway.app

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure**:
   - Railway auto-detects Node.js
   - Add environment variable:
     - `ENCRYPTION_KEY`: (generate as shown above)

4. **Deploy**:
   - Deployment starts automatically
   - Get your URL from the dashboard

---

## Alternative: Deploy to Heroku

### Prerequisites
- Heroku CLI installed
- Heroku account

### Step-by-Step Instructions

1. **Install Heroku CLI** (if not installed):
   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku
   
   # Or download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Login to Heroku**:
   ```bash
   heroku login
   ```

3. **Create Heroku app**:
   ```bash
   cd /Users/joec/Desktop/projects/adyen-report-downloader-webapp
   heroku create adyen-report-downloader
   ```

4. **Set environment variables**:
   ```bash
   # Generate and set encryption key
   ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   heroku config:set ENCRYPTION_KEY=$ENCRYPTION_KEY
   ```

5. **Deploy**:
   ```bash
   git push heroku main
   ```

6. **Open your app**:
   ```bash
   heroku open
   ```

---

## Important Security Considerations

### Before Public Deployment:

1. **⚠️ Add Authentication**: Currently anyone can access the app
   - Consider adding basic HTTP authentication
   - Or restrict by IP address

2. **⚠️ API Key Security**: API keys are stored in memory
   - Consider using Redis for production
   - Or implement database storage

3. **⚠️ Rate Limiting**: Add rate limiting to prevent abuse
   ```bash
   npm install express-rate-limit
   ```

4. **⚠️ CORS Configuration**: Update CORS settings for production
   - Restrict allowed origins
   - Don't use `*` in production

5. **⚠️ Environment Variables**: Never commit sensitive data
   - Use `.env` files (already in `.gitignore`)
   - Set variables in hosting platform

### Recommended Security Additions

Add to `server.js`:

```javascript
// Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Basic auth (optional)
const basicAuth = require('express-basic-auth');
app.use(basicAuth({
  users: { 'admin': process.env.ADMIN_PASSWORD },
  challenge: true
}));
```

---

## Monitoring and Maintenance

### After Deployment:

1. **Monitor Logs**: Check platform logs regularly
2. **Set Up Alerts**: Configure error notifications
3. **Backup Data**: If using database, set up backups
4. **Update Dependencies**: Keep packages up to date
5. **Test Regularly**: Run test suite after updates

---

## Troubleshooting

### Common Issues:

1. **Port Issues**:
   - Ensure `server.js` uses `process.env.PORT || 3000`
   - Hosting platforms assign ports dynamically

2. **Build Failures**:
   - Check Node.js version compatibility
   - Ensure all dependencies in `package.json`

3. **Memory Issues**:
   - Free tiers have memory limits
   - Consider upgrading or optimizing

4. **Timeout Issues**:
   - Large downloads may timeout
   - Consider implementing chunked downloads

---

## Cost Estimates

| Platform | Free Tier | Paid Plans |
|----------|-----------|------------|
| **Render** | 750 hours/month | $7/month |
| **Railway** | $5 credit/month | Pay as you go |
| **Heroku** | 550 hours/month | $7/month |
| **Fly.io** | 3 VMs free | $1.94/month |

---

## Next Steps

1. Choose a platform (Render recommended)
2. Follow the deployment steps above
3. Test the deployed application
4. Add security measures
5. Monitor and maintain

Good luck with your deployment! 🚀
