import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import multer from 'multer';
import { extractVideoId } from '../utils/helpers.js';
import WhisperTranscriber from '../utils/whisperTranscriber.js';
import TranscriptBurner from '../utils/transcriptBurner.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: (req, file, cb) => {
    // Accept only video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

// Initialize transcriber and burner
const transcriber = new WhisperTranscriber();
const burner = new TranscriptBurner('output');

// Route to transcribe an uploaded video
router.post('/transcribe-video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }
    
    const videoPath = req.file.path;
    const options = {
      model: req.body.model || 'base',
      language: req.body.language || 'en',
      speakerDiarization: req.body.speakerDiarization === 'true',
      numSpeakers: parseInt(req.body.numSpeakers || '2')
    };
    
    // Transcribe the video
    const segments = await transcriber.transcribeVideo(videoPath, options);
    
    res.json({
      success: true,
      videoPath,
      segments,
      count: segments.length
    });
    
  } catch (error: any) {
    console.error('Error transcribing video:', error);
    res.status(500).json({ 
      error: 'Failed to transcribe video', 
      details: error.message 
    });
  }
});

// Route to transcribe and burn subtitles in one step
router.post('/transcribe-and-burn', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }
    
    const videoPath = req.file.path;
    const transcribeOptions = {
      model: req.body.model || 'base',
      language: req.body.language || 'en',
      speakerDiarization: req.body.speakerDiarization === 'true',
      numSpeakers: parseInt(req.body.numSpeakers || '2')
    };
    
    const burnOptions = {
      outputFileName: req.body.outputFileName || path.basename(videoPath, path.extname(videoPath)) + '_subtitled',
      fontName: req.body.fontName || 'Arial',
      fontSize: parseInt(req.body.fontSize || '24'),
      fontColor: req.body.fontColor || 'white',
      backgroundColor: req.body.backgroundColor || 'black@0.5',
      position: req.body.position || 'bottom',
      padding: parseInt(req.body.padding || '20')
    };
    
    // Transcribe the video
    const segments = await transcriber.transcribeVideo(videoPath, transcribeOptions);
    
    // Burn subtitles onto the video
    let outputPath;
    if (transcribeOptions.speakerDiarization) {
      // Use speaker diarization version if enabled
      outputPath = await burner.burnTranscriptsWithSpeakers(videoPath, segments, {
        ...burnOptions,
        speakerColor: req.body.speakerColor || 'yellow'
      });
    } else {
      // Use regular subtitle burning
      outputPath = await burner.burnTranscripts(videoPath, segments, burnOptions);
    }
    
    res.json({
      success: true,
      videoPath,
      outputPath,
      segments,
      count: segments.length
    });
    
  } catch (error: any) {
    console.error('Error transcribing and burning subtitles:', error);
    res.status(500).json({ 
      error: 'Failed to process video', 
      details: error.message 
    });
  }
});

// Route to transcribe a YouTube video by URL
router.post('/transcribe-youtube', async (req, res) => {
  try {
    const { url, model, language, speakerDiarization, numSpeakers } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    // Dynamically import the downloader to avoid circular deps
    const youtubeDownloader = (await import('../utils/youtubeDownloader.js')).default;

    // Download the YouTube video
    const videoPath = await youtubeDownloader.downloadVideo(url, {
      quality: 'highest',
      filter: 'audioandvideo'
    });

    // Prepare Whisper options
    const options = {
      model: model || 'base',
      language: language || 'en',
      speakerDiarization: speakerDiarization === true || speakerDiarization === 'true',
      numSpeakers: parseInt(numSpeakers || '2')
    };

    // Transcribe the video
    const segments = await transcriber.transcribeVideo(videoPath, options);

    res.json({
      success: true,
      videoPath,
      segments,
      count: segments.length
    });
  } catch (error: any) {
    console.error('Error transcribing YouTube video:', error);
    res.status(500).json({
      error: 'Failed to transcribe YouTube video',
      details: error.message
    });
  }
});

export default router; 