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
    console.log('=== API KEY DECRYPTION DEBUG ===');
    console.log('Encrypted data structure:', {
      hasEncrypted: !!encryptedData.encrypted,
      hasIv: !!encryptedData.iv,
      encryptedLength: encryptedData.encrypted?.length,
      ivLength: encryptedData.iv?.length
    });
    
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey, 'hex'), Buffer.from(encryptedData.iv, 'hex'));
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      console.log('Decryption successful:', {
        resultLength: decrypted.length,
        resultPreview: decrypted.substring(0, 10) + '...'
      });
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error.message);
      console.error('Encrypted data:', JSON.stringify(encryptedData, null, 2));
      throw new Error(`Failed to decrypt API key: ${error.message}`);
    }
  }

  storeApiKey(userId, apiKey) {
    console.log('=== API KEY STORAGE DEBUG ===');
    console.log('User ID:', userId);
    console.log('API key length:', apiKey.length);
    console.log('API key preview:', apiKey.substring(0, 10) + '...');
    
    // Check if key already exists
    const existingKey = this.apiKeys.get(userId);
    console.log('Existing key found:', !!existingKey);
    if (existingKey) {
      console.log('Existing key created at:', existingKey.createdAt);
      console.log('Overriding existing API key for user:', userId);
    }
    
    // Validate API key format (Adyen API keys are typically 30+ characters)
    if (!apiKey || apiKey.length < 30) {
      throw new Error('Invalid API key format');
    }

    // Encrypt the API key before storing
    const encrypted = this.encryptApiKey(apiKey);
    console.log('API key encrypted successfully');
    
    // Store with timestamp for potential cleanup (this will override existing key)
    this.apiKeys.set(userId, {
      encrypted,
      createdAt: new Date(),
      lastUsed: new Date()
    });

    console.log(`API key stored/overridden for user: ${userId}`);
    console.log('Total stored keys:', this.apiKeys.size);
  }

  getApiKey(userId) {
    console.log('=== API KEY RETRIEVAL DEBUG ===');
    console.log('User ID:', userId);
    
    const keyData = this.apiKeys.get(userId);
    if (!keyData) {
      console.error('API key not found for user:', userId);
      throw new Error('API key not found for user');
    }

    console.log('Key data found:', {
      hasEncrypted: !!keyData.encrypted,
      createdAt: keyData.createdAt,
      lastUsed: keyData.lastUsed
    });

    // Update last used timestamp
    keyData.lastUsed = new Date();

    // Decrypt and return the API key
    console.log('Decrypting API key...');
    const decryptedKey = this.decryptApiKey(keyData.encrypted);
    
    console.log('API key decrypted successfully:', {
      length: decryptedKey.length,
      preview: decryptedKey.substring(0, 10) + '...',
      containsInvalidChars: /[^\x20-\x7E]/.test(decryptedKey)
    });
    
    return decryptedKey;
  }

  deleteApiKey(userId) {
    const deleted = this.apiKeys.delete(userId);
    if (deleted) {
      console.log(`API key deleted for user: ${userId}`);
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

    for (const [userId, keyData] of this.apiKeys.entries()) {
      if (keyData.createdAt < cutoff) {
        this.apiKeys.delete(userId);
        console.log(`Cleaned up expired API key for user: ${userId}`);
      }
    }
  }
}

module.exports = ApiKeyManager;
