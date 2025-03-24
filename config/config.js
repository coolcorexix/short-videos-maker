// Configuration settings
import dotenv from 'dotenv';
dotenv.config();

export default {
  port: process.env.PORT || 3000,
  youtubeApiKey: process.env.YOUTUBE_API_KEY || 'YOUR_API_KEY',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY
}; 