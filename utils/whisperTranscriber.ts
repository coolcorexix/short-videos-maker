import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer';
import cacheUtils from './cacheUtils.js';
import TimeUtils from './timeUtils.js';
import { TranscriptSegment } from './transcriptBurner.js';

interface WhisperOptions {
  model?: string;
  language?: string;
  task?: 'transcribe' | 'translate';
  outputDir?: string;
  device?: 'cpu' | 'cuda';
  verbose?: boolean;
  wordTimestamps?: boolean;
  speakerDiarization?: boolean;
  numSpeakers?: number;
}

/**
 * Utility class for transcribing audio/video using OpenAI's Whisper model
 */
class WhisperTranscriber {
  private outputDir: string;
  private tempDir: string;
  private defaultOptions: WhisperOptions;

  constructor(outputDir = 'transcripts', tempDir = 'temp') {
    this.outputDir = outputDir;
    this.tempDir = tempDir;
    
    // Create output directories if they don't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Default options
    this.defaultOptions = {
      model: 'tiny',  // Use tiny model by default (faster download)
      language: 'en',
      task: 'transcribe',
      device: 'cpu',
      verbose: false,
      wordTimestamps: true,
      speakerDiarization: false,
      numSpeakers: 2
    };
  }

  /**
   * Transcribe a video file using Whisper
   * @param videoPath Path to the video file
   * @param options Whisper options
   * @returns Promise resolving to an array of transcript segments
   */
  async transcribeVideo(
    videoPath: string,
    options: WhisperOptions = {}
  ): Promise<TranscriptSegment[]> {
    try {
      // Check if file exists
      if (!fs.existsSync(videoPath)) {
        throw new Error(`Video file not found: ${videoPath}`);
      }
      
      // Generate a cache key based on the video file and options
      const videoStats = fs.statSync(videoPath);
      const cacheKey = {
        service: 'whisperTranscribe',
        videoPath,
        fileSize: videoStats.size,
        modifiedTime: videoStats.mtime.getTime(),
        options: { ...this.defaultOptions, ...options }
      };
      
      // Check cache
      const cachedTranscript = cacheUtils.get<TranscriptSegment[]>(cacheKey);
      if (cachedTranscript) {
        console.log(`Using cached transcript for ${videoPath}`);
        return cachedTranscript;
      }
      
      console.log(`Transcribing video: ${videoPath}`);
      
      // First check if whisper is installed
      await this.checkWhisperInstallation();
      
      // Extract audio from video if needed
      const audioPath = await this.extractAudio(videoPath);
      
      // Merge options with defaults
      const mergedOptions = { ...this.defaultOptions, ...options };
      
      // Transcribe using whisper
      const segments = await this.runWhisperTranscription(audioPath, mergedOptions);
      
      // Cache the result
      cacheUtils.set(cacheKey, segments);
      
      return segments;
      
    } catch (error) {
      console.error('Error transcribing video:', error);
      throw error;
    }
  }
  
  /**
   * Check if whisper is installed and install if needed
   */
  private async checkWhisperInstallation(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Try to run whisper --help
      const whisper = spawn('whisper', ['--help']);
      
      whisper.on('error', () => {
        console.log('Whisper not found, attempting to install...');
        this.installWhisper()
          .then(resolve)
          .catch(reject);
      });
      
      whisper.on('close', (code) => {
        if (code === 0) {
          console.log('Whisper is installed');
          resolve();
        } else {
          console.log('Whisper installation check failed, attempting to install...');
          this.installWhisper()
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }
  
  /**
   * Install whisper using pip
   */
  private async installWhisper(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      console.log('Installing whisper...');
      
      // Install whisper using pip
      const pip = spawn('pip', ['install', '-U', 'openai-whisper']);
      
      let stdoutData = '';
      let stderrData = '';
      
      pip.stdout.on('data', (data) => {
        stdoutData += data.toString();
        process.stdout.write(data.toString());
      });
      
      pip.stderr.on('data', (data) => {
        stderrData += data.toString();
        process.stderr.write(data.toString());
      });
      
      pip.on('close', (code) => {
        if (code === 0) {
          console.log('Whisper installed successfully');
          resolve();
        } else {
          reject(new Error(`Failed to install whisper: ${stderrData}`));
        }
      });
    });
  }
  
  /**
   * Extract audio from video file
   * @param videoPath Path to the video file
   * @returns Promise resolving to the path of the extracted audio
   */
  private async extractAudio(videoPath: string): Promise<string> {
    const outputFileName = `audio_${path.basename(videoPath, path.extname(videoPath))}.wav`;
    const outputPath = path.join(this.tempDir, outputFileName);
    
    // Skip if audio file already exists
    if (fs.existsSync(outputPath)) {
      console.log(`Using existing audio file: ${outputPath}`);
      return outputPath;
    }
    
    console.log(`Extracting audio from ${videoPath}`);
    
    return new Promise<string>((resolve, reject) => {
      // Use FFmpeg to extract audio
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-vn',  // No video
        '-acodec', 'pcm_s16le',  // PCM 16-bit little-endian format
        '-ar', '16000',  // 16kHz sample rate (what Whisper expects)
        '-ac', '1',  // Mono
        '-y',  // Overwrite output file
        outputPath
      ]);
      
      let stderrData = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderrData += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`Audio extracted: ${outputPath}`);
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}: ${stderrData}`));
        }
      });
      
      ffmpeg.on('error', (err) => {
        reject(new Error(`Failed to start FFmpeg process: ${err.message}`));
      });
    });
  }
  
  /**
   * Run whisper transcription
   * @param audioPath Path to the audio file
   * @param options Whisper options
   * @returns Promise resolving to an array of transcript segments
   */
  private async runWhisperTranscription(
    audioPath: string,
    options: WhisperOptions
  ): Promise<TranscriptSegment[]> {
    const outputFileName = `whisper_${path.basename(audioPath, path.extname(audioPath))}`;
    const outputJsonPath = path.join(this.outputDir, `${outputFileName}.json`);
    
    console.log(`Running whisper transcription with model: ${options.model}`);
    
    // Build whisper command
    // Note: Using Python directly with the whisper module to avoid PATH issues
    const pythonScript = `
import sys
import json
import os
import ssl
import whisper

# Disable SSL verification if needed
try:
    # First try to set environment variable
    os.environ['PYTHONHTTPSVERIFY'] = '0'
    
    # Also try to disable SSL verification directly
    ssl._create_default_https_context = ssl._create_unverified_context
except:
    print("Warning: Could not disable SSL verification", file=sys.stderr)

try:
    # Load model
    print("Loading model: ${options.model}")
    model = whisper.load_model("${options.model}")
    
    # Transcribe
    print("Transcribing audio...")
    result = model.transcribe(
        "${audioPath.replace(/\\/g, '\\\\')}",
        language="${options.language}",
        task="${options.task}",
        verbose=${options.verbose ? 'True' : 'False'},
        word_timestamps=${options.wordTimestamps ? 'True' : 'False'}
    )
    
    # Save result
    print("Saving results...")
    with open("${outputJsonPath.replace(/\\/g, '\\\\')}", "w") as f:
        json.dump(result, f, indent=2)
    
    print("Transcription complete")
    sys.exit(0)
except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    sys.exit(1)
`;
    
    const tempScriptPath = path.join(this.tempDir, `whisper_script_${uuidv4()}.py`);
    fs.writeFileSync(tempScriptPath, pythonScript);
    
    return new Promise<TranscriptSegment[]>((resolve, reject) => {
      // Run Python script
      const python = spawn('python3', [tempScriptPath]);
      
      let stderrData = '';
      let stdoutData = '';
      
      python.stdout.on('data', (data) => {
        stdoutData += data.toString();
        console.log(`Whisper: ${data.toString().trim()}`);
      });
      
      python.stderr.on('data', (data) => {
        stderrData += data.toString();
        console.error(`Whisper error: ${data.toString().trim()}`);
      });
      
      python.on('close', (code) => {
        // Clean up temp script
        if (fs.existsSync(tempScriptPath)) {
          fs.unlinkSync(tempScriptPath);
        }
        
        if (code === 0) {
          try {
            // Check if output file exists
            if (!fs.existsSync(outputJsonPath)) {
              reject(new Error('Whisper did not generate output file'));
              return;
            }
            
            // Read the JSON output file
            const jsonOutput = JSON.parse(fs.readFileSync(outputJsonPath, 'utf8'));
            
            // Convert Whisper segments to our TranscriptSegment format
            const segments: TranscriptSegment[] = jsonOutput.segments.map((segment: any) => {
              const startTime = TimeUtils.secondsToTimestamp(segment.start);
              const endTime = TimeUtils.secondsToTimestamp(segment.end);
              
              return {
                start: startTime,
                end: endTime,
                text: segment.text.trim(),
                speaker: segment.speaker || undefined
              };
            });
            
            resolve(segments);
          } catch (error) {
            reject(new Error(`Failed to parse Whisper output: ${error}`));
          }
        } else {
          reject(new Error(`Whisper process exited with code ${code}: ${stderrData}`));
        }
      });
      
      python.on('error', (err) => {
        // Clean up temp script
        if (fs.existsSync(tempScriptPath)) {
          fs.unlinkSync(tempScriptPath);
        }
        
        reject(new Error(`Failed to start Python process: ${err.message}`));
      });
    });
  }
}

export default WhisperTranscriber; 