// YouTube API interactions
import axios from 'axios';
import config from '../config/config.js';

// Get video info from YouTube API
export async function getVideoInfo(videoId) {
  try {
    const response = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${config.youtubeApiKey}`
    );
    
    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('Video not found');
    }
    
    return response.data.items[0];
  } catch (error) {
    if (error.response && error.response.data) {
      console.error('Error fetching video info:', error.response.data);
    } else {
      console.error('Error fetching video info:', error);
    }
    throw error;
  }
}

// Get video details including content details
export async function getVideoDetails(videoId) {
  try {
    const response = await axios.get(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails,snippet&key=${config.youtubeApiKey}`
    );
    
    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('Video not found');
    }
    
    return response.data.items[0];
  } catch (error) {
    console.error('Error fetching video details:', error);
    throw error;
  }
} 