// Combined data routes
import express from 'express';
import { extractVideoId } from '../utils/helpers.js';
import { getVideoChaptersWithTranscript } from '../services/transcriptService.js';

const router = express.Router();

// Route to get combined chapters and transcript
router.post('/combined', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }
    
    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    
    const combinedData = await getVideoChaptersWithTranscript(videoId);
    
    res.json(combinedData);
    
  } catch (error) {
    console.error('Error fetching combined data:', error);
    res.status(500).json({ error: 'Failed to fetch combined data', details: error.message });
  }
});

export default router; 