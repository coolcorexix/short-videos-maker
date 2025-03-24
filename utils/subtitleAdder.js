import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Utility module for adding subtitles to videos using FFmpeg
 */
class SubtitleAdder {
  constructor(outputDir = 'output') {
    this.outputDir = outputDir;
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  /**
   * Add subtitles to a video
   * @param {string} videoPath - Path to the input video
   * @param {string} subtitlePath - Path to the subtitle file (.srt, .vtt, .ass)
   * @param {Object} options - Additional options
   * @param {string} options.outputFileName - Custom output filename (without extension)
   * @param {boolean} options.hardSub - Whether to burn subtitles into the video (default: false)
   * @param {string} options.fontName - Font name for hardcoded subtitles (default: 'Arial')
   * @param {number} options.fontSize - Font size for hardcoded subtitles (default: 24)
   * @param {string} options.fontColor - Font color for hardcoded subtitles (default: 'white')
   * @param {string} options.outlineColor - Outline color for hardcoded subtitles (default: 'black')
   * @param {number} options.outlineWidth - Outline width for hardcoded subtitles (default: 2)
   * @returns {Promise<string>} - Path to the output video file
   */
  async addSubtitles(videoPath, subtitlePath, options = {}) {
    const {
      outputFileName = `subtitled_${uuidv4().substring(0, 8)}`,
      hardSub = false,
      fontName = 'Arial',
      fontSize = 24,
      fontColor = 'white',
      outlineColor = 'black',
      outlineWidth = 2
    } = options;
    
    // Validate input files
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Input video file not found: ${videoPath}`);
    }
    
    if (!fs.existsSync(subtitlePath)) {
      throw new Error(`Subtitle file not found: ${subtitlePath}`);
    }
    
    // Determine subtitle format from file extension
    const subtitleFormat = path.extname(subtitlePath).toLowerCase();
    if (!['.srt', '.vtt', '.ass', '.ssa'].includes(subtitleFormat)) {
      throw new Error(`Unsupported subtitle format: ${subtitleFormat}. Supported formats: .srt, .vtt, .ass, .ssa`);
    }
    
    const outputPath = path.join(this.outputDir, `${outputFileName}.mp4`);
    
    // Prepare FFmpeg command arguments
    let ffmpegArgs = [];
    
    if (hardSub) {
      // Hardcode subtitles into the video
      ffmpegArgs = [
        '-i', videoPath,
        '-vf', `subtitles=${subtitlePath}:force_style='FontName=${fontName},FontSize=${fontSize},PrimaryColour=${this._colorToASS(fontColor)},OutlineColour=${this._colorToASS(outlineColor)},BorderStyle=4,Outline=${outlineWidth}'`,
        '-c:v', 'libx264',
        '-c:a', 'copy',
        '-preset', 'medium',
        '-y',
        outputPath
      ];
    } else {
      // Add subtitles as a separate stream (soft subtitles)
      ffmpegArgs = [
        '-i', videoPath,
        '-i', subtitlePath,
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-c:s', 'mov_text',
        '-metadata:s:s:0', `language=${this._getSubtitleLanguage(subtitlePath)}`,
        '-y',
        outputPath
      ];
    }
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      let stderrData = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderrData += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
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
   * Create an SRT subtitle file from a transcript with timestamps
   * @param {Array<{start: string, end: string, text: string}>} segments - Array of transcript segments
   * @param {string} outputFileName - Output filename (without extension)
   * @returns {Promise<string>} - Path to the created SRT file
   */
  async createSRTFile(segments, outputFileName = `subtitle_${uuidv4().substring(0, 8)}`) {
    const outputPath = path.join(this.outputDir, `${outputFileName}.srt`);
    
    let srtContent = '';
    
    segments.forEach((segment, index) => {
      // Format: sequence number
      srtContent += `${index + 1}\n`;
      
      // Format: start time --> end time
      const startTime = this._formatTimeForSRT(segment.start);
      const endTime = this._formatTimeForSRT(segment.end);
      srtContent += `${startTime} --> ${endTime}\n`;
      
      // Format: subtitle text
      srtContent += `${segment.text}\n\n`;
    });
    
    return new Promise((resolve, reject) => {
      fs.writeFile(outputPath, srtContent, 'utf8', (err) => {
        if (err) {
          reject(new Error(`Failed to write SRT file: ${err.message}`));
        } else {
          resolve(outputPath);
        }
      });
    });
  }
  
  /**
   * Extract subtitles from a video file
   * @param {string} videoPath - Path to the input video
   * @param {string} outputFormat - Output subtitle format ('srt', 'vtt', 'ass')
   * @param {string} outputFileName - Custom output filename (without extension)
   * @returns {Promise<string>} - Path to the extracted subtitle file
   */
  async extractSubtitles(videoPath, outputFormat = 'srt', outputFileName = null) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Input video file not found: ${videoPath}`);
    }
    
    const fileName = outputFileName || `extracted_subtitle_${uuidv4().substring(0, 8)}`;
    const outputPath = path.join(this.outputDir, `${fileName}.${outputFormat}`);
    
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', videoPath,
        '-map', '0:s:0',
        '-c:s', outputFormat,
        '-y',
        outputPath
      ]);
      
      let stderrData = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderrData += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
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
   * Format time for SRT file (HH:MM:SS,mmm)
   * @param {string} time - Time in various formats
   * @returns {string} - Time formatted for SRT
   * @private
   */
  _formatTimeForSRT(time) {
    // Handle different time formats
    let hours = 0, minutes = 0, seconds = 0, milliseconds = 0;
    
    if (typeof time === 'number') {
      // Convert seconds to components
      const totalSeconds = time;
      hours = Math.floor(totalSeconds / 3600);
      minutes = Math.floor((totalSeconds % 3600) / 60);
      seconds = Math.floor(totalSeconds % 60);
      milliseconds = Math.round((totalSeconds % 1) * 1000);
    } else if (typeof time === 'string') {
      if (time.includes(':')) {
        // Parse HH:MM:SS or MM:SS format
        const parts = time.split(':');
        
        if (parts.length === 3) {
          // HH:MM:SS format
          hours = parseInt(parts[0], 10);
          minutes = parseInt(parts[1], 10);
          
          if (parts[2].includes('.')) {
            const secParts = parts[2].split('.');
            seconds = parseInt(secParts[0], 10);
            milliseconds = parseInt(secParts[1].padEnd(3, '0').substring(0, 3), 10);
          } else {
            seconds = parseInt(parts[2], 10);
          }
        } else if (parts.length === 2) {
          // MM:SS format
          minutes = parseInt(parts[0], 10);
          
          if (parts[1].includes('.')) {
            const secParts = parts[1].split('.');
            seconds = parseInt(secParts[0], 10);
            milliseconds = parseInt(secParts[1].padEnd(3, '0').substring(0, 3), 10);
          } else {
            seconds = parseInt(parts[1], 10);
          }
        }
      } else {
        // Assume seconds
        const totalSeconds = parseFloat(time);
        hours = Math.floor(totalSeconds / 3600);
        minutes = Math.floor((totalSeconds % 3600) / 60);
        seconds = Math.floor(totalSeconds % 60);
        milliseconds = Math.round((totalSeconds % 1) * 1000);
      }
    }
    
    // Format as HH:MM:SS,mmm (SRT format uses comma for milliseconds)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  }
  
  /**
   * Convert color name or hex to ASS color format
   * @param {string} color - Color name or hex
   * @returns {string} - ASS format color
   * @private
   */
  _colorToASS(color) {
    // Simple color name to hex conversion for common colors
    const colorMap = {
      'white': 'FFFFFF',
      'black': '000000',
      'red': 'FF0000',
      'green': '00FF00',
      'blue': '0000FF',
      'yellow': 'FFFF00',
      'cyan': '00FFFF',
      'magenta': 'FF00FF'
    };
    
    // If it's a color name, convert to hex
    if (colorMap[color.toLowerCase()]) {
      return `&H${colorMap[color.toLowerCase()]}`;
    }
    
    // If it's already a hex value (with or without #)
    if (color.startsWith('#')) {
      color = color.substring(1);
    }
    
    // ASS uses BGR format, so reverse the RGB
    if (color.length === 6) {
      const r = color.substring(0, 2);
      const g = color.substring(2, 4);
      const b = color.substring(4, 6);
      return `&H${b}${g}${r}`;
    }
    
    // Default to white if format is unknown
    return '&HFFFFFF';
  }
  
  /**
   * Try to determine subtitle language from filename or content
   * @param {string} subtitlePath - Path to subtitle file
   * @returns {string} - ISO 639-2 language code
   * @private
   */
  _getSubtitleLanguage(subtitlePath) {
    // Extract language from filename if it follows common patterns
    const filename = path.basename(subtitlePath, path.extname(subtitlePath));
    
    // Check for common language codes in filename
    const langMatches = filename.match(/\.(en|eng|fr|fre|es|spa|de|ger|it|ita|ru|rus|ja|jpn|zh|chi)$/i);
    if (langMatches) {
      const langCode = langMatches[1].toLowerCase();
      
      // Map to ISO 639-2 codes
      const langMap = {
        'en': 'eng', 'eng': 'eng',
        'fr': 'fre', 'fre': 'fre',
        'es': 'spa', 'spa': 'spa',
        'de': 'ger', 'ger': 'ger',
        'it': 'ita', 'ita': 'ita',
        'ru': 'rus', 'rus': 'rus',
        'ja': 'jpn', 'jpn': 'jpn',
        'zh': 'chi', 'chi': 'chi'
      };
      
      return langMap[langCode] || 'eng';
    }
    
    // Default to English
    return 'eng';
  }
}

export default SubtitleAdder; 