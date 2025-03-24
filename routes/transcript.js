// Transcript-related routes
import express from 'express';
import { extractVideoId } from '../utils/helpers.js';
import { getTranscript } from '../services/transcriptService.js';
import { getVideoDetails } from '../services/youtubeService.js';

const router = express.Router();

// Route to get transcript
router.post('/transcript', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }
    
    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    
    const { segments, plainText } = await getTranscript(videoId);
    
    res.json({
      videoId,
      segments,
      plainText
    });
    
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({ error: 'Failed to fetch transcript', details: error.message });
  }
});

// Route to get video segments
router.post('/video-segments', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }
    
    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    
    // Get video details
    const videoInfo = await getVideoDetails(videoId);
    
    // Get transcript
    const { segments } = await getTranscript(videoId);
    
    // Combine video info with transcript segments
    const videoSegments = {
      videoId,
      title: videoInfo.snippet.title,
      description: videoInfo.snippet.description,
      duration: videoInfo.contentDetails.duration, // ISO 8601 duration format
      publishedAt: videoInfo.snippet.publishedAt,
      channelTitle: videoInfo.snippet.channelTitle,
      segments
    };
    
    res.json(videoSegments);
    
  } catch (error) {
    console.error('Error fetching video segments:', error);
    res.status(500).json({ error: 'Failed to fetch video segments', details: error.message });
  }
});

export default router; 