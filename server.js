const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { runDownload } = require('./downloadEngine');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs for sensitive endpoints
  message: 'Too many attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// File upload configuration
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Store active downloads
const activeDownloads = new Map();

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// File upload endpoint
app.post('/api/upload-structure', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const content = fs.readFileSync(req.file.path, 'utf8');
    const accountStructure = JSON.parse(content);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({ success: true, data: accountStructure });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(400).json({ error: error.message });
  }
});

// Server-side decryption for API key
function decryptApiKey(encryptedApiKey, userId) {
  try {
    // Decode from Base64
    const encrypted = atob(encryptedApiKey);
    
    // XOR decryption (matching client-side encryption)
    const key = userId + '-salt';
    let decrypted = '';
    
    for (let i = 0; i < encrypted.length; i++) {
      decrypted += String.fromCharCode(
        encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt API key');
  }
}

// API key storage endpoints removed - using session-based approach instead

// Save account structure endpoint
app.post('/api/save-structure', (req, res) => {
  try {
    const { data } = req.body;
    const filename = `account_structure_${Date.now()}.json`;
    const filepath = path.join(__dirname, 'exports', filename);
    
    // Ensure exports directory exists
    if (!fs.existsSync(path.join(__dirname, 'exports'))) {
      fs.mkdirSync(path.join(__dirname, 'exports'));
    }
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    res.json({ success: true, filename, data: fs.readFileSync(filepath, 'utf8') });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start download endpoint (session-based version)
app.post('/api/download', async (req, res) => {
  try {
    const { encryptedApiKey, userId, targetMonths, selectedEntities, accountStructure, reportTypes, outputDir } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!encryptedApiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    // Decrypt the API key from request
    let apiKey;
    try {
      apiKey = decryptApiKey(encryptedApiKey, userId);
    } catch (error) {
      return res.status(400).json({ error: 'Failed to decrypt API key' });
    }
    
    // Validate API key format (Adyen API keys are typically 30+ characters)
    if (!apiKey || apiKey.length < 30) {
      return res.status(400).json({ error: 'Invalid API key format' });
    }
    
    console.log('=== SECURE SERVER DOWNLOAD START ===');
    console.log('Request received:', {
      userId: userId.substring(0, 8) + '...',
      targetMonths: targetMonths?.length || 0,
      selectedEntitiesCount: selectedEntities?.length || 0,
      reportTypesCount: reportTypes?.length || 0,
      accountStructureGroups: Object.keys(accountStructure || {}).length
    });
    
    // Generate download ID
    const downloadId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`Generated download ID: ${downloadId}`);
    
    // Create abort controller for this download
    const abortController = new AbortController();
    
    // Store download info
    activeDownloads.set(downloadId, {
      abortController,
      status: 'starting',
      progress: 0,
      message: 'Initializing download...'
    });
    
    // Start download in background
    runDownload({
      apiKey,
      targetMonths,
      selectedEntities,
      accountStructure,
      reportTypes,
      outputDir,
      abortController,
      onProgress: (progress, message) => {
        const download = activeDownloads.get(downloadId);
        if (download) {
          download.progress = progress;
          download.message = message;
          download.status = progress === 100 ? 'completed' : 'downloading';
          console.log(`Progress ${downloadId}: ${progress}% - ${message}`);
        }
      },
      onComplete: (summary) => {
        const download = activeDownloads.get(downloadId);
        if (download) {
          download.status = 'completed';
          download.summary = summary;
          download.progress = 100;
          // Store ZIP buffer for download
          download.zipBuffer = summary.zipBuffer;
          download.zipFilename = summary.zipFilename;
          console.log(`Download completed ${downloadId}:`, {
            downloadedFiles: summary.downloadedFiles,
            zipSize: summary.zipBuffer.length
          });
        }
      },
      onError: (error) => {
        const download = activeDownloads.get(downloadId);
        if (download) {
          download.status = 'error';
          download.error = error.message;
          console.error(`Download error ${downloadId}:`, error.message);
        }
      }
    });
    
    console.log(`Download started, returning ID: ${downloadId}`);
    res.json({ success: true, downloadId });
    
  } catch (error) {
    console.error('Server download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download ZIP file endpoint
app.get('/api/download/:id/zip', (req, res) => {
  const { id } = req.params;
  const download = activeDownloads.get(id);
  
  if (!download) {
    return res.status(404).json({ error: 'Download not found' });
  }
  
  if (download.status !== 'completed' || !download.zipBuffer) {
    return res.status(400).json({ error: 'Download not completed or ZIP not available' });
  }
  
  // Set headers for ZIP download
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${download.zipFilename}"`);
  res.setHeader('Content-Length', download.zipBuffer.length);
  
  // Send ZIP buffer
  res.send(download.zipBuffer);
});

// Get download status endpoint
app.get('/api/download/:id/status', (req, res) => {
  const { id } = req.params;
  const download = activeDownloads.get(id);
  
  if (!download) {
    return res.status(404).json({ error: 'Download not found' });
  }
  
  res.json(download);
});

// Cancel download endpoint
app.post('/api/download/:id/cancel', (req, res) => {
  const { id } = req.params;
  const download = activeDownloads.get(id);
  
  if (!download) {
    return res.status(404).json({ error: 'Download not found' });
  }
  
  download.abortController.abort();
  download.status = 'cancelled';
  download.message = 'Download cancelled by user';
  
  res.json({ success: true, message: 'Download cancelled' });
});

// Clean up completed downloads periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, download] of activeDownloads.entries()) {
    // Remove downloads older than 1 hour that are completed, cancelled, or error
    if (now - id.split('_')[1] > 3600000 && ['completed', 'cancelled', 'error'].includes(download.status)) {
      activeDownloads.delete(id);
    }
  }
}, 300000); // Check every 5 minutes

// Start server
app.listen(PORT, () => {
  console.log(`Adyen Report Downloader Web App running on http://localhost:${PORT}`);
  console.log('Features:');
  console.log('- No installation required');
  console.log('- Real-time progress tracking');
  console.log('- Multiple concurrent downloads');
  console.log('- Auto-updates (when deployed)');
  console.log('- Mobile friendly');
});
