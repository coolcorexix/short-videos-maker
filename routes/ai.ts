// Route to extract video highlights with function calling
router.post('/extract-highlights-v2', async (req, res) => {
  try {
    const { url, count = 3 } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }
    
    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    
    // Get video data with transcript
    const videoData = await getVideoChaptersWithTranscript(videoId);
    
    // Extract highlights using function calling
    const highlights = await extractVideoHighlightsV2(videoData, count);
    
    // Return the highlights
    res.json({
      videoId,
      title: videoData.title,
      channelTitle: videoData.channelTitle,
      highlights
    });
    
  } catch (error) {
    console.error('Error extracting highlights:', error);
    res.status(500).json({ 
      error: 'Failed to extract highlights', 
      details: error.message 
    });
  }
});

// Add a route to clear cache
router.post('/clear-cache', (req, res) => {
  try {
    const { key } = req.body;
    
    if (key) {
      cacheUtils.clear(key);
      res.json({ success: true, message: `Cache cleared for key: ${JSON.stringify(key)}` });
    } else {
      cacheUtils.clearAll();
      res.json({ success: true, message: 'All cache cleared' });
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache', details: error.message });
  }
}); 