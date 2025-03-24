import express from 'express';
import youtubeDownloader from '../utils/youtubeDownloader.js';
import { extractVideoId } from '../utils/helpers.js';

const router = express.Router();

// Route to download a YouTube video
router.post('/download-video', async (req, res) => {
  try {
    const { url, quality, filter } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }
    
    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    
    // Check if video is already downloaded
    const existingPath = youtubeDownloader.getDownloadedVideoPath(url);
    
    if (existingPath) {
      return res.json({
        success: true,
        videoId,
        filePath: existingPath,
        alreadyDownloaded: true
      });
    }
    
    // Download the video
    const filePath = await youtubeDownloader.downloadVideo(url, {
      quality: quality || 'highest',
      filter: filter || 'audioandvideo'
    });
    
    res.json({
      success: true,
      videoId,
      filePath,
      alreadyDownloaded: false
    });
    
  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({ 
      error: 'Failed to download video', 
      details: error.message 
    });
  }
});

// Route to check if a video is already downloaded
router.post('/check-downloaded', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }
    
    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    
    // Check if video is already downloaded
    const existingPath = youtubeDownloader.getDownloadedVideoPath(url);
    
    res.json({
      videoId,
      isDownloaded: !!existingPath,
      filePath: existingPath
    });
    
  } catch (error) {
    console.error('Error checking downloaded video:', error);
    res.status(500).json({ 
      error: 'Failed to check downloaded video', 
      details: error.message 
    });
  }
});

export default router; 