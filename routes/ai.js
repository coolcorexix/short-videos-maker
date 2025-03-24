// AI/DeepSeek routes
import express from 'express';
import { extractVideoId } from '../utils/helpers.js';
import { sendPrompt, analyzeTranscriptByChapters } from '../services/aiService.js';
import { getVideoChaptersWithTranscript } from '../services/transcriptService.js';

const router = express.Router();

// Route to send prompts to DeepSeek
router.post('/deepseek', async (req, res) => {
  try {
    const { prompt, model = 'deepseek-coder', temperature = 0.7 } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    const result = await sendPrompt(prompt, model, temperature);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error calling DeepSeek API:', error);
    res.status(500).json({ 
      error: 'Failed to get response from DeepSeek', 
      details: error.message 
    });
  }
});

// Route to analyze transcript
router.post('/analyze-transcript', async (req, res) => {
  try {
    const { url, question } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    
    // Get chapters with transcripts
    const videoData = await getVideoChaptersWithTranscript(videoId);
    
    // Analyze transcript
    const { chapterAnalyses, overallAnalysis } = await analyzeTranscriptByChapters(videoData, question);
    
    // Return the analysis
    res.json({
      videoId,
      title: videoData.title,
      channelTitle: videoData.channelTitle,
      question,
      chapterAnalyses,
      overallAnalysis
    });
    
  } catch (error) {
    console.error('Error analyzing transcript:', error);
    res.status(500).json({ 
      error: 'Failed to analyze transcript', 
      details: error.message 
    });
  }
});

export default router; 