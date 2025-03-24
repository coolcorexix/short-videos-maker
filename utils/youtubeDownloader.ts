import * as fs from 'fs';
import * as path from 'path';
import * as ytdl from 'ytdl-core';
import { spawn } from 'child_process';
import { extractVideoId } from './helpers.js';
import cacheUtils from './cacheUtils.js';

interface DownloadOptions {
  quality?: 'highest' | 'lowest' | 'highestaudio' | 'lowestaudio' | 'highestvideo' | 'lowestvideo';
  filter?: 'audioandvideo' | 'videoonly' | 'audioonly';
  format?: string;
  downloadFolder?: string;
}

/**
 * Utility class for downloading YouTube videos
 */
class YouTubeDownloader {
  private downloadFolder: string;

  constructor(downloadFolder = 'downloads') {
    this.downloadFolder = downloadFolder;
    
    // Create download directory if it doesn't exist
    if (!fs.existsSync(downloadFolder)) {
      fs.mkdirSync(downloadFolder, { recursive: true });
    }
  }

  /**
   * Download a YouTube video if not already downloaded
   * @param url YouTube video URL
   * @param options Download options
   * @returns Promise resolving to the path of the downloaded video
   */
  async downloadVideo(
    url: string,
    options: DownloadOptions = {}
  ): Promise<string> {
    try {
      // Extract video ID from URL
      const videoId = extractVideoId(url);
      
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }
      
      // Check if already downloaded
      const existingPath = this.getDownloadedVideoPath(url);
      if (existingPath) {
        console.log(`Video already downloaded: ${existingPath}`);
        return existingPath;
      }
      
      // Try to get video info
      let info;
      try {
        info = await ytdl.getInfo(videoId);
      } catch (error) {
        console.warn(`Error getting video info with ytdl-core: ${error.message}`);
        console.log('Falling back to yt-dlp...');
        return this.downloadWithYtDlp(url, options);
      }
      
      // Create a safe filename from the video title
      const safeTitle = info.videoDetails.title
        .replace(/[^\w\s]/gi, '')
        .replace(/\s+/g, '_')
        .substring(0, 100);
      
      // Determine file extension based on format
      let fileExtension = '.mp4';
      if (options.filter === 'audioonly') {
        fileExtension = '.mp3';
      }
      
      // Create the file path
      const filePath = path.join(
        options.downloadFolder || this.downloadFolder,
        `${videoId}_${safeTitle}${fileExtension}`
      );
      
      console.log(`Downloading video: ${info.videoDetails.title}`);
      
      // Set download options
      const downloadOptions: ytdl.downloadOptions = {
        quality: options.quality || 'highest'
      };
      
      if (options.filter) {
        downloadOptions.filter = options.filter;
      }
      
      if (options.format) {
        downloadOptions.format = options.format;
      }
      
      // Download the video
      return new Promise<string>((resolve, reject) => {
        try {
          const stream = ytdl(url, downloadOptions);
          const fileStream = fs.createWriteStream(filePath);
          
          // Track download progress
          let downloadedBytes = 0;
          const totalBytes = parseInt(info.videoDetails.lengthSeconds) * 1000000; // Rough estimate
          
          stream.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            const progress = (downloadedBytes / totalBytes * 100).toFixed(2);
            process.stdout.write(`\rDownloading... ${progress}%`);
          });
          
          stream.pipe(fileStream);
          
          fileStream.on('finish', () => {
            console.log(`\nDownload complete: ${filePath}`);
            resolve(filePath);
          });
          
          fileStream.on('error', (error) => {
            console.error(`Error writing to file: ${error.message}`);
            // Try fallback method
            this.downloadWithYtDlp(url, options)
              .then(resolve)
              .catch(reject);
          });
          
          stream.on('error', (error) => {
            console.error(`Error downloading video: ${error.message}`);
            // Try fallback method
            this.downloadWithYtDlp(url, options)
              .then(resolve)
              .catch(reject);
          });
        } catch (error) {
          console.error(`Error setting up download: ${error.message}`);
          // Try fallback method
          this.downloadWithYtDlp(url, options)
            .then(resolve)
            .catch(reject);
        }
      });
      
    } catch (error) {
      console.error('Error downloading YouTube video:', error);
      // Try fallback method
      return this.downloadWithYtDlp(url, options);
    }
  }

  /**
   * Download video using yt-dlp (more reliable fallback)
   * @param url YouTube URL
   * @param options Download options
   * @returns Promise resolving to the path of the downloaded video
   */
  private async downloadWithYtDlp(
    url: string,
    options: DownloadOptions = {}
  ): Promise<string> {
    try {
      const videoId = extractVideoId(url);
      
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }
      
      const outputFolder = options.downloadFolder || this.downloadFolder;
      const outputTemplate = path.join(outputFolder, `${videoId}_%(title)s.%(ext)s`);
      
      console.log(`Downloading with yt-dlp: ${url}`);
      
      // Build yt-dlp command
      const args = [
        url,
        '-o', outputTemplate,
        '--no-playlist',
        '--restrict-filenames'
      ];
      
      // Add format options
      if (options.filter === 'audioonly') {
        args.push('-x', '--audio-format', 'mp3');
      } else if (options.quality === 'highest') {
        args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best');
      }
      
      return new Promise<string>((resolve, reject) => {
        // Check if yt-dlp is installed
        const ytDlp = spawn('yt-dlp', ['--version']);
        
        ytDlp.on('error', () => {
          reject(new Error('yt-dlp is not installed. Please install it first: pip install yt-dlp'));
        });
        
        ytDlp.on('close', (code) => {
          if (code !== 0) {
            reject(new Error('yt-dlp is not installed or not working properly'));
            return;
          }
          
          // Run the download
          const download = spawn('yt-dlp', args);
          
          let stdoutData = '';
          let stderrData = '';
          
          download.stdout.on('data', (data) => {
            stdoutData += data.toString();
            process.stdout.write(data.toString());
          });
          
          download.stderr.on('data', (data) => {
            stderrData += data.toString();
            process.stderr.write(data.toString());
          });
          
          download.on('close', (code) => {
            if (code !== 0) {
              reject(new Error(`yt-dlp exited with code ${code}: ${stderrData}`));
              return;
            }
            
            // Find the downloaded file
            const files = fs.readdirSync(outputFolder);
            const downloadedFile = files.find(file => file.startsWith(videoId + '_'));
            
            if (!downloadedFile) {
              reject(new Error('Could not find downloaded file'));
              return;
            }
            
            const filePath = path.join(outputFolder, downloadedFile);
            console.log(`Download complete: ${filePath}`);
            resolve(filePath);
          });
        });
      });
    } catch (error) {
      console.error('Error downloading with yt-dlp:', error);
      throw error;
    }
  }

  /**
   * Get the path to a video if it's already downloaded
   * @param url YouTube video URL
   * @param downloadFolder Optional custom download folder
   * @returns Path to the video file or null if not downloaded
   */
  getDownloadedVideoPath(url: string, downloadFolder?: string): string | null {
    try {
      const videoId = extractVideoId(url);
      
      if (!videoId) {
        return null;
      }
      
      const folder = downloadFolder || this.downloadFolder;
      
      // Check if any file with this video ID exists in the download folder
      const files = fs.readdirSync(folder);
      const matchingFile = files.find(file => file.startsWith(videoId + '_'));
      
      if (matchingFile) {
        return path.join(folder, matchingFile);
      }
      
      return null;
    } catch (error) {
      console.error('Error checking for downloaded video:', error);
      return null;
    }
  }

  /**
   * Download a YouTube video with progress tracking
   * @param url YouTube video URL
   * @param progressCallback Callback function for progress updates
   * @param options Download options
   * @returns Promise resolving to the path of the downloaded video
   */
  async downloadVideoWithProgress(
    url: string,
    progressCallback: (progress: number) => void,
    options: DownloadOptions = {}
  ): Promise<string> {
    try {
      // Check if already downloaded
      const existingPath = this.getDownloadedVideoPath(url);
      if (existingPath) {
        console.log(`Video already downloaded: ${existingPath}`);
        progressCallback(100);
        return existingPath;
      }
      
      // Extract video ID from URL
      const videoId = extractVideoId(url);
      
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }
      
      // Try to get video info
      let info;
      try {
        info = await ytdl.getInfo(videoId);
      } catch (error) {
        console.warn(`Error getting video info with ytdl-core: ${error.message}`);
        console.log('Falling back to yt-dlp...');
        
        // Use yt-dlp with progress updates
        progressCallback(10); // Start progress
        
        const filePath = await this.downloadWithYtDlp(url, options);
        progressCallback(100); // Complete progress
        return filePath;
      }
      
      // Create a safe filename from the video title
      const safeTitle = info.videoDetails.title
        .replace(/[^\w\s]/gi, '')
        .replace(/\s+/g, '_')
        .substring(0, 100);
      
      // Determine file extension based on format
      let fileExtension = '.mp4';
      if (options.filter === 'audioonly') {
        fileExtension = '.mp3';
      }
      
      // Create the file path
      const filePath = path.join(
        options.downloadFolder || this.downloadFolder,
        `${videoId}_${safeTitle}${fileExtension}`
      );
      
      console.log(`Downloading video: ${info.videoDetails.title}`);
      
      // Set download options
      const downloadOptions: ytdl.downloadOptions = {
        quality: options.quality || 'highest'
      };
      
      if (options.filter) {
        downloadOptions.filter = options.filter;
      }
      
      if (options.format) {
        downloadOptions.format = options.format;
      }
      
      // Download the video
      return new Promise<string>((resolve, reject) => {
        try {
          const stream = ytdl(url, downloadOptions);
          const fileStream = fs.createWriteStream(filePath);
          
          // Track download progress
          let downloadedBytes = 0;
          const totalBytes = parseInt(info.videoDetails.lengthSeconds) * 1000000; // Rough estimate
          
          stream.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            const progress = Math.min(99, Math.floor(downloadedBytes / totalBytes * 100));
            progressCallback(progress);
          });
          
          stream.pipe(fileStream);
          
          fileStream.on('finish', () => {
            console.log(`\nDownload complete: ${filePath}`);
            progressCallback(100);
            resolve(filePath);
          });
          
          fileStream.on('error', (error) => {
            console.error(`Error writing to file: ${error.message}`);
            // Try fallback method
            progressCallback(10); // Reset progress
            this.downloadWithYtDlp(url, options)
              .then((path) => {
                progressCallback(100);
                resolve(path);
              })
              .catch(reject);
          });
          
          stream.on('error', (error) => {
            console.error(`Error downloading video: ${error.message}`);
            // Try fallback method
            progressCallback(10); // Reset progress
            this.downloadWithYtDlp(url, options)
              .then((path) => {
                progressCallback(100);
                resolve(path);
              })
              .catch(reject);
          });
        } catch (error) {
          console.error(`Error setting up download: ${error.message}`);
          // Try fallback method
          progressCallback(10); // Reset progress
          this.downloadWithYtDlp(url, options)
            .then((path) => {
              progressCallback(100);
              resolve(path);
            })
            .catch(reject);
        }
      });
      
    } catch (error) {
      console.error('Error downloading YouTube video:', error);
      throw error;
    }
  }
}

export default new YouTubeDownloader(); 