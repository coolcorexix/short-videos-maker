import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import TimeUtils from './timeUtils.js';

interface ClipOptions {
  outputDir?: string;
  outputFileName?: string;
  format?: string;
  codec?: string;
  quality?: string;
}

/**
 * Utility class for clipping videos using FFmpeg
 */
class VideoClipper {
  private outputDir: string;

  constructor(outputDir = 'clips') {
    this.outputDir = outputDir;
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  /**
   * Cut a segment from a video
   * @param inputPath Path to the input video
   * @param startTime Start time in seconds or HH:MM:SS format
   * @param duration Duration in seconds or HH:MM:SS format
   * @param options Additional options
   * @returns Promise resolving to the path of the clipped video
   */
  async cutVideo(
    inputPath: string,
    startTime: number | string,
    duration: number | string,
    options: ClipOptions = {}
  ): Promise<string> {
    try {
      // Format start time and duration
      const formattedStartTime = typeof startTime === 'number' 
        ? TimeUtils.secondsToTimestamp(startTime) 
        : startTime;
      
      const formattedDuration = typeof duration === 'number'
        ? TimeUtils.secondsToTimestamp(duration)
        : duration;
      
      // Create output file path
      const outputFileName = options.outputFileName || `clip_${uuidv4().substring(0, 8)}`;
      const outputFormat = options.format || 'mp4';
      const outputPath = path.join(options.outputDir || this.outputDir, `${outputFileName}.${outputFormat}`);
      
      console.log(`Cutting video from ${formattedStartTime} for ${formattedDuration}`);
      
      // Build FFmpeg command
      const ffmpegArgs = [
        '-i', inputPath,
        '-ss', formattedStartTime,
        '-t', formattedDuration,
        '-c:v', options.codec || 'libx264',
        '-c:a', 'aac',
        '-strict', 'experimental'
      ];
      
      // Add quality option if specified
      if (options.quality) {
        ffmpegArgs.push('-crf', options.quality);
      } else {
        ffmpegArgs.push('-crf', '23'); // Default quality
      }
      
      // Add output file
      ffmpegArgs.push('-y', outputPath);
      
      // Run FFmpeg
      return new Promise<string>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', ffmpegArgs);
        
        let stderrData = '';
        
        ffmpeg.stderr.on('data', (data) => {
          stderrData += data.toString();
          // Uncomment to see FFmpeg progress
          // process.stderr.write(data);
        });
        
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            console.log(`Video clip created: ${outputPath}`);
            resolve(outputPath);
          } else {
            reject(new Error(`FFmpeg process exited with code ${code}: ${stderrData}`));
          }
        });
        
        ffmpeg.on('error', (err) => {
          reject(new Error(`Failed to start FFmpeg process: ${err.message}`));
        });
      });
      
    } catch (error) {
      console.error('Error cutting video:', error);
      throw error;
    }
  }

  /**
   * Combine multiple video clips into one
   * @param inputPaths Array of paths to input videos
   * @param options Additional options
   * @returns Promise resolving to the path of the combined video
   */
  async combineVideos(
    inputPaths: string[],
    options: ClipOptions = {}
  ): Promise<string> {
    try {
      if (inputPaths.length === 0) {
        throw new Error('No input videos provided');
      }
      
      // Create temporary file list
      const tempListPath = path.join(this.outputDir, `temp_list_${uuidv4().substring(0, 8)}.txt`);
      const fileContent = inputPaths.map(p => `file '${p}'`).join('\n');
      fs.writeFileSync(tempListPath, fileContent);
      
      // Create output file path
      const outputFileName = options.outputFileName || `combined_${uuidv4().substring(0, 8)}`;
      const outputFormat = options.format || 'mp4';
      const outputPath = path.join(options.outputDir || this.outputDir, `${outputFileName}.${outputFormat}`);
      
      console.log(`Combining ${inputPaths.length} videos`);
      
      // Build FFmpeg command
      const ffmpegArgs = [
        '-f', 'concat',
        '-safe', '0',
        '-i', tempListPath,
        '-c:v', options.codec || 'libx264',
        '-c:a', 'aac',
        '-strict', 'experimental'
      ];
      
      // Add quality option if specified
      if (options.quality) {
        ffmpegArgs.push('-crf', options.quality);
      } else {
        ffmpegArgs.push('-crf', '23'); // Default quality
      }
      
      // Add output file
      ffmpegArgs.push('-y', outputPath);
      
      // Run FFmpeg
      return new Promise<string>((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', ffmpegArgs);
        
        let stderrData = '';
        
        ffmpeg.stderr.on('data', (data) => {
          stderrData += data.toString();
          // Uncomment to see FFmpeg progress
          // process.stderr.write(data);
        });
        
        ffmpeg.on('close', (code) => {
          // Clean up temp file
          if (fs.existsSync(tempListPath)) {
            fs.unlinkSync(tempListPath);
          }
          
          if (code === 0) {
            console.log(`Combined video created: ${outputPath}`);
            resolve(outputPath);
          } else {
            reject(new Error(`FFmpeg process exited with code ${code}: ${stderrData}`));
          }
        });
        
        ffmpeg.on('error', (err) => {
          // Clean up temp file
          if (fs.existsSync(tempListPath)) {
            fs.unlinkSync(tempListPath);
          }
          
          reject(new Error(`Failed to start FFmpeg process: ${err.message}`));
        });
      });
      
    } catch (error) {
      console.error('Error combining videos:', error);
      throw error;
    }
  }
}

export default VideoClipper;