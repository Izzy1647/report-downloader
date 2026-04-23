# Adyen Report Downloader - Web App

A modern web-based application for bulk-downloading Adyen reports across multiple merchant accounts. This web app provides all the functionality of the desktop version with additional benefits of web deployment.

## Features

### Web App Benefits
- **No Installation Required** - Access from any modern browser
- **Automatic Updates** - Always using the latest version
- **Mobile Friendly** - Works on tablets and mobile devices
- **Real-time Progress** - Live download progress tracking
- **Multi-tab Support** - Run multiple downloads simultaneously
- **Secure Processing** - API keys processed server-side only

### Core Functionality
- **4 Report Types**: Monthly Finance, Invoice Overview, Daily Payment Accounting, Settlement Detail
- **Group Management**: Organize merchant accounts into logical groups
- **Month Filtering**: Download reports for specific months only
- **Progress Tracking**: Real-time progress with detailed logging
- **Error Handling**: Comprehensive error reporting and retry options
- **Import/Export**: JSON-based account structure management

## Quick Start

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Installation

```bash
# Clone or download the project
cd adyen-report-downloader-webapp

# Install dependencies
npm install

# Copy environment file (optional)
cp .env.example .env

# Start the development server
npm start
```

The app will be available at `http://localhost:3000`

### Development

```bash
# Start with auto-reload
npm run dev
```

## Usage

1. **Enter API Key**: Provide your Adyen Report User API key
2. **Select Month**: Choose the target month for downloads
3. **Configure Report Types**: Select which report types to download
4. **Load Account Structure**: 
   - Import a JSON file with groups and merchant accounts
   - Or add groups manually using the interface
5. **Select Groups**: Choose which groups to include in the download
6. **Start Download**: Monitor progress in real-time

## Account Structure Format

The JSON file should map group names to arrays of merchant account codes:

```json
{
  "Sample Group 1": [
    "MerchantAccount1",
    "MerchantAccount2",
    "MerchantAccount3"
  ],
  "Sample Group 2": [
    "MerchantAccount4",
    "MerchantAccount5"
  ]
}
```

## API Endpoints

### File Operations
- `POST /api/upload-structure` - Upload account structure JSON
- `POST /api/save-structure` - Save and download account structure

### Download Operations
- `POST /api/download` - Start a new download
- `GET /api/download/:id/status` - Get download progress
- `POST /api/download/:id/cancel` - Cancel a download

## Architecture

### Backend (Node.js + Express)
- **Server**: Express.js with CORS support
- **File Handling**: Multer for JSON uploads
- **Download Engine**: Core logic for report retrieval
- **Progress Tracking**: Real-time status updates
- **Error Handling**: Comprehensive error management

### Frontend (Vanilla JavaScript)
- **No Framework Dependency**: Pure HTML/CSS/JavaScript
- **Responsive Design**: Mobile-friendly interface
- **Real-time Updates**: WebSocket-like progress tracking
- **Modern UI**: Clean, professional design

### Security Features
- **Server-side Processing**: API keys never exposed to client
- **Session-based Downloads**: Temporary download management
- **File Upload Limits**: Restricted file sizes and types
- **Input Validation**: Comprehensive input sanitization

## Deployment Options

### Option 1: Self-Hosted
```bash
# Install production dependencies
npm install --production

# Start production server
NODE_ENV=production npm start
```

### Option 2: Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Option 3: Cloud Platforms
- **Heroku**: Direct Node.js deployment
- **Vercel**: Serverless functions
- **AWS**: EC2 or Lambda
- **Azure**: App Service or Functions

## Environment Variables

```bash
PORT=3000                    # Server port
NODE_ENV=development         # Environment mode
```

## Comparison: Web App vs Desktop App

| Feature | Web App | Desktop App |
|---------|---------|-------------|
| **Installation** | None required | Download & install |
| **Updates** | Automatic | Manual |
| **Mobile Access** | Full support | None |
| **Resource Usage** | Server-side | Client-side |
| **Multi-user** | Easy to scale | Single user |
| **API Key Security** | Server-side only | Local storage |
| **Offline Use** | No | Yes |
| **File Access** | Download only | Full access |

## Security Considerations

### API Key Management
- API keys are processed server-side only
- No client-side storage of credentials
- Session-based processing prevents persistence

### File Upload Security
- Limited to JSON files only
- 5MB file size limit
- Temporary upload storage with cleanup

### Network Security
- HTTPS recommended for production
- CORS configuration for cross-origin requests
- Request timeout and rate limiting

## Troubleshooting

### Common Issues

1. **"Download failed" errors**
   - Verify API key is valid and active
   - Check merchant account permissions
   - Ensure target month has available reports

2. **"Upload failed" errors**
   - Verify JSON file format is correct
   - Check file size is under 5MB
   - Ensure file contains valid merchant accounts

3. **Progress tracking issues**
   - Refresh page if progress stops updating
   - Check browser console for errors
   - Verify server is running

### Server Issues

1. **Port already in use**
   ```bash
   # Kill process on port 3000
   lsof -ti:3000 | xargs kill -9
   
   # Or use different port
   PORT=3001 npm start
   ```

2. **Upload directory missing**
   ```bash
   mkdir uploads exports
   ```

## Development Notes

### Adding New Report Types
1. Update `getReportTypeAndDirectory()` in `downloadEngine.js`
2. Add checkbox in `index.html`
3. Update `getSelectedReportTypes()` in `app.js`

### Custom Styling
- Modify `public/styles.css`
- CSS variables for easy theming
- Mobile-first responsive design

### Performance Optimization
- Progress tracking uses polling (1-second intervals)
- File uploads are processed synchronously
- Downloads run in background processes

## License

MIT License - see LICENSE file for details

## Support

For issues and feature requests:
1. Check the troubleshooting section
2. Review browser console for errors
3. Verify server logs for backend issues
4. Test with sample data first

---

**Note**: This web app provides the same core functionality as the desktop version while eliminating installation requirements and adding web-specific benefits like mobile access and automatic updates.
