// Transcript processing
import { YoutubeTranscript } from 'youtube-transcript';
import { getVideoInfo } from './youtubeService.js';
import getYoutubeChapters from 'get-youtube-chapters';
import TimeUtils from '../utils/timeUtils.js';
import cacheUtils from '../utils/cacheUtils.js';

// Get transcript for a video with caching
export async function getTranscript(videoId) {
  try {
    // Check cache first (cache for 24 hours)
    const cacheKey = { service: 'transcript', videoId };
    const cachedData = cacheUtils.get(cacheKey, 86400);
    
    if (cachedData) {
      console.log(`Using cached transcript for ${videoId}`);
      return cachedData;
    }
    
    // If not in cache, fetch from API
    console.log(`Fetching transcript for ${videoId}`);
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (!transcript || transcript.length === 0) {
      throw new Error('No transcript found for this video');
    }
    
    // Format the transcript
    const formattedTranscript = transcript.map(item => ({
      text: item.text,
      start: item.offset,
      duration: item.duration
    }));
    
    // Also provide a plain text version
    const plainText = transcript.map(item => item.text).join(' ');
    
    const result = {
      segments: formattedTranscript,
      plainText
    };
    
    // Save to cache
    cacheUtils.set(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw error;
  }
}

// Get video chapters with transcript (with caching)
export async function getVideoChaptersWithTranscript(videoId) {
  try {
    // Check cache first (cache for 24 hours)
    const cacheKey = { service: 'chaptersWithTranscript', videoId };
    const cachedData = cacheUtils.get(cacheKey, 86400);
    
    if (cachedData) {
      console.log(`Using cached chapters with transcript for ${videoId}`);
      return cachedData;
    }
    
    // If not in cache, process the data
    console.log(`Processing chapters with transcript for ${videoId}`);
    
    // Get video info
    const videoInfo = await getVideoInfo(videoId);
    const description = videoInfo.snippet.description;
    
    // Get transcript
    const { segments: formattedTranscript, plainText } = await getTranscript(videoId);
    
    // Extract chapters from description
    const rawChapters = description.split("\n").filter(line => line.startsWith('('));
    const parsedYoutubeChapters = getYoutubeChapters(description);
    let chapters = [];
    if (parsedYoutubeChapters.length > 0) {
      chapters = parsedYoutubeChapters.map((chapter, index) => ({
        title: chapter.title,
        start: chapter.start,
        startFormatted: TimeUtils.secondsToTimestamp(chapter.start),
        segments: []
      }));
    } else {
      chapters = [{
        title: "Full Video",
        start: 0,
        startFormatted: "00:00",
        segments: []
      }];
    }
    
    // Calculate end times for each chapter
    chapters.forEach((chapter, index) => {
      if (index < chapters.length - 1) {
        chapter.end = chapters[index + 1].start;
      } else {
        // For the last chapter, use the end of the transcript
        const lastSegment = formattedTranscript[formattedTranscript.length - 1];
        chapter.end = lastSegment.start + lastSegment.duration;
      }
      
      // Format duration
      const durationSeconds = chapter.end - chapter.start;
      const minutes = Math.floor(durationSeconds / 60);
      const seconds = Math.floor(durationSeconds % 60);
      chapter.durationFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    });
    
    // Assign transcript segments to chapters
    formattedTranscript.forEach(segment => {
      // Find the chapter this segment belongs to
      for (let i = 0; i < chapters.length; i++) {
        if (segment.start >= chapters[i].start && 
            (i === chapters.length - 1 || segment.start < chapters[i + 1].start)) {
          chapters[i].segments.push(segment);
          break;
        }
      }
    });
    
    const result = {
      videoId,
      title: videoInfo.snippet.title,
      channelTitle: videoInfo.snippet.channelTitle,
      chapters: chapters,
      plainTranscript: plainText
    };
    
    // Save to cache
    cacheUtils.set(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Error in getVideoChaptersWithTranscript:', error);
    throw error;
  }
} 