const crypto = require('crypto');

class ApiKeyManager {
  constructor() {
    this.apiKeys = new Map(); // In-memory storage (consider using Redis for production)
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateEncryptionKey();
  }

  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  encryptApiKey(apiKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), iv);
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return { encrypted, iv: iv.toString('hex') };
  }

  decryptApiKey(encryptedData) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), Buffer.from(encryptedData.iv, 'hex'));
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Decryption failed');
      throw new Error('Failed to decrypt API key');
    }
  }

  storeApiKey(userId, apiKey) {
    // Validate API key format (Adyen API keys are typically 30+ characters)
    if (!apiKey || apiKey.length < 30) {
      throw new Error('Invalid API key format');
    }

    // Encrypt the API key before storing
    const encrypted = this.encryptApiKey(apiKey);
    
    // Store with timestamp for potential cleanup (this will override existing key)
    this.apiKeys.set(userId, {
      encrypted,
      createdAt: new Date(),
      lastUsed: new Date()
    });

    console.log(`API key stored for user: ${userId.substring(0, 8)}...`);
  }

  getApiKey(userId) {
    const keyData = this.apiKeys.get(userId);
    if (!keyData) {
      throw new Error('API key not found for user');
    }

    // Update last used timestamp
    keyData.lastUsed = new Date();

    // Decrypt and return the API key
    return this.decryptApiKey(keyData.encrypted);
  }

  deleteApiKey(userId) {
    const deleted = this.apiKeys.delete(userId);
    if (deleted) {
      console.log(`API key deleted for user: ${userId.substring(0, 8)}...`);
    }
    return deleted;
  }

  validateApiKey(apiKey) {
    // Basic validation for API keys
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Remove whitespace and check minimum length
    const trimmedKey = apiKey.trim();
    
    // Allow shorter keys for testing and development
    // In production, you might want to enforce stricter validation
    return trimmedKey.length >= 10 && trimmedKey.length <= 500;
  }

  cleanup() {
    // Clean up API keys older than 24 hours (for production use)
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [userId, keyData] of this.apiKeys.entries()) {
      if (keyData.createdAt < cutoff) {
        this.apiKeys.delete(userId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired API keys`);
    }
  }
}

module.exports = ApiKeyManager;
