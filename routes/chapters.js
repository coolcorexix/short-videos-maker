// Chapter-related routes
import express from 'express';
import { extractVideoId } from '../utils/helpers.js';
import { getVideoInfo } from '../services/youtubeService.js';

const router = express.Router();

// Route to get video chapters
router.post('/video-chapters', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }
    
    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    
    // Get video info
    const videoInfo = await getVideoInfo(videoId);
    const description = videoInfo.snippet.description;
    
    // Extract chapters from description
    const rawChapters = description.split("\n").filter(line => line.startsWith('('));
    
    // Extract timestamp from rawChapters
    const chapters = rawChapters.map(chapter => {
      try {
        const timeMatch = chapter.match(/([0-9]{1,2}:[0-9]{2}:[0-9]{2}|[0-9]{1,2}:[0-9]{2})/);
        if (!timeMatch) return null;
        
        const timeStr = timeMatch[0];
        const title = chapter.replace(timeStr, '').trim();
        
        // Convert timestamp to seconds
        const timeStrInSeconds = timeStr.split(':').reverse().reduce((acc, part, index) => {
          return acc + (parseInt(part) * Math.pow(60, index));
        }, 0);
        
        return { title, start: timeStrInSeconds };
      } catch (err) {
        console.error(`Error parsing chapter: ${chapter}`, err);
        return null;
      }
    }).filter(Boolean);
    
    res.json({
      videoId,
      title: videoInfo.snippet.title,
      channelTitle: videoInfo.snippet.channelTitle,
      chapters: chapters,
      hasActualChapters: chapters.length > 0
    });
    
  } catch (error) {
    console.error('Error fetching video chapters:', error);
    res.status(500).json({ error: 'Failed to fetch video chapters', details: error.message });
  }
});

export default router; 