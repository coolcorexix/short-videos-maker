import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Simple file-based caching utility
 */
class CacheUtils {
  private cacheDir: string;
  
  constructor(cacheDir = '.cache') {
    this.cacheDir = cacheDir;
    
    // Create cache directory if it doesn't exist
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
  }
  
  /**
   * Generate a cache key from input parameters
   * @param params Parameters to hash
   * @returns Cache key string
   */
  private generateKey(params: any): string {
    const hash = crypto.createHash('md5').update(JSON.stringify(params)).digest('hex');
    return hash;
  }
  
  /**
   * Check if caching is enabled
   * @returns True if caching is enabled
   */
  isCachingEnabled(): boolean {
    // Enable caching by default in development, disable in production
    return process.env.ENABLE_CACHE !== 'false' && 
           (process.env.NODE_ENV === 'development' || process.env.ENABLE_CACHE === 'true');
  }
  
  /**
   * Get cached data if available and not expired
   * @param params Parameters to use as cache key
   * @param maxAge Maximum age in seconds (default: 1 hour)
   * @returns Cached data or null if not found/expired
   */
  get<T>(params: any, maxAge: number = 3600): T | null {
    if (!this.isCachingEnabled()) return null;
    
    const key = this.generateKey(params);
    const filePath = path.join(this.cacheDir, `${key}.json`);
    
    if (fs.existsSync(filePath)) {
      try {
        const stats = fs.statSync(filePath);
        const fileAge = (Date.now() - stats.mtimeMs) / 1000; // Age in seconds
        
        // Check if cache is still valid
        if (fileAge < maxAge) {
          const data = fs.readFileSync(filePath, 'utf8');
          return JSON.parse(data) as T;
        }
      } catch (error) {
        console.warn('Error reading cache:', error);
      }
    }
    
    return null;
  }
  
  /**
   * Save data to cache
   * @param params Parameters to use as cache key
   * @param data Data to cache
   */
  set(params: any, data: any): void {
    if (!this.isCachingEnabled()) return;
    
    const key = this.generateKey(params);
    const filePath = path.join(this.cacheDir, `${key}.json`);
    
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('Error writing to cache:', error);
    }
  }
  
  /**
   * Clear all cached data
   */
  clearAll(): void {
    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.cacheDir, file));
      }
    } catch (error) {
      console.warn('Error clearing cache:', error);
    }
  }
  
  /**
   * Clear specific cached data
   * @param params Parameters to use as cache key
   */
  clear(params: any): void {
    const key = this.generateKey(params);
    const filePath = path.join(this.cacheDir, `${key}.json`);
    
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.warn('Error clearing cache item:', error);
      }
    }
  }
}

export default new CacheUtils(); 