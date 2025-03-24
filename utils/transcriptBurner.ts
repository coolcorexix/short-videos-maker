import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer';

// Define interfaces for our types
export interface WordTiming {
  word: string;
  start: string;
  end: string;
}

export interface TranscriptSegment {
  start: string;
  end: string;
  text: string;
  speaker?: string;
  words?: WordTiming[];
}

interface TranscriptOptions {
  outputFileName?: string;
  fontName?: string;
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
  position?: string;
  padding?: number;
  speakerColor?: string;
}

interface PipOptions extends TranscriptOptions {
  pipPosition?: string;
  pipSize?: number;
}

/**
 * Utility class for burning transcripts onto videos using FFmpeg
 */
class TranscriptBurner {
  private outputDir: string;

  constructor(outputDir = 'output') {
    this.outputDir = outputDir;
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  /**
   * Burn transcript segments onto a video
   * @param inputVideoPath Path to the input video
   * @param segments Array of transcript segments with start, end, and text
   * @param options Configuration options
   * @returns Promise resolving to the output file path
   */
  async burnTranscripts(
    inputVideoPath: string,
    segments: TranscriptSegment[],
    options: TranscriptOptions = {}
  ): Promise<string> {
    // Create output directory if it doesn't exist
    const outputDir = path.dirname(path.join(this.outputDir, `${options.outputFileName || 'output'}.mp4`));
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Ensure the output file isn't locked
    const outputPath = path.join(this.outputDir, `${options.outputFileName || 'output'}.mp4`);
    if (fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch (error) {
        console.warn(`Could not remove existing file: ${outputPath}`, error);
      }
    }
    
    // Set default options
    const {
      fontName = 'Arial',
      fontSize = 24,
      fontColor = 'white',
      backgroundColor = 'black@0.5',
      position = 'bottom',
      padding = 20
    } = options;
    
    // Create subtitle file
    const subtitlePath = await this._createSubtitleFile(segments);
    
    // Determine position parameters
    const positionParams = this._getPositionParameters(position, padding);
    
    // Output file path
    const absoluteOutputPath = path.resolve(outputPath);
    
    return new Promise<string>((resolve, reject) => {
      // FFmpeg command to burn subtitles
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputVideoPath,
        '-vf', `subtitles=${subtitlePath}:force_style='FontName=${fontName},FontSize=${fontSize},PrimaryColour=${this._colorToHex(fontColor)},BackColour=${this._colorToHex(backgroundColor)},${positionParams}'`,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'fast',
        '-y',
        absoluteOutputPath
      ]);
      
      let stderrData = '';
      
      ffmpeg.stderr?.on('data', (data: Buffer) => {
        stderrData += data.toString();
      });
      
      ffmpeg.on('close', (code: number | null) => {
        // Clean up subtitle file
        fs.unlinkSync(subtitlePath);
        
        if (code === 0) {
          resolve(absoluteOutputPath);
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}: ${stderrData}`));
        }
      });
      
      ffmpeg.on('error', (err: Error) => {
        // Clean up subtitle file
        if (fs.existsSync(subtitlePath)) {
          fs.unlinkSync(subtitlePath);
        }
        reject(new Error(`Failed to start FFmpeg process: ${err.message}`));
      });
    });
  }
  
  /**
   * Burn transcript segments with speaker identification onto a video
   * @param inputVideoPath Path to the input video
   * @param segments Array of transcript segments with start, end, text, and speaker
   * @param options Configuration options
   * @returns Promise resolving to the output file path
   */
  async burnTranscriptsWithSpeakers(
    inputVideoPath: string,
    segments: TranscriptSegment[],
    options: TranscriptOptions = {}
  ): Promise<string> {
    // Set default options
    const {
      outputFileName = `speaker_transcript_${uuidv4().substring(0, 8)}`,
      fontName = 'Arial',
      fontSize = 24,
      fontColor = 'white',
      speakerColor = 'yellow',
      backgroundColor = 'black@0.5',
      position = 'bottom',
      padding = 20
    } = options;
    
    // Create subtitle file with speaker names
    const subtitlePath = await this._createSpeakerSubtitleFile(segments, speakerColor);
    
    // Determine position parameters
    const positionParams = this._getPositionParameters(position, padding);
    
    // Output file path
    const outputPath = path.join(this.outputDir, `${outputFileName}.mp4`);
    
    return new Promise<string>((resolve, reject) => {
      // FFmpeg command to burn subtitles
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputVideoPath,
        '-vf', `subtitles=${subtitlePath}:force_style='FontName=${fontName},FontSize=${fontSize},PrimaryColour=${this._colorToHex(fontColor)},BackColour=${this._colorToHex(backgroundColor)},${positionParams}'`,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'fast',
        '-y',
        outputPath
      ]);
      
      let stderrData = '';
      
      ffmpeg.stderr?.on('data', (data: Buffer) => {
        stderrData += data.toString();
      });
      
      ffmpeg.on('close', (code: number | null) => {
        // Clean up subtitle file
        fs.unlinkSync(subtitlePath);
        
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}: ${stderrData}`));
        }
      });
      
      ffmpeg.on('error', (err: Error) => {
        // Clean up subtitle file
        if (fs.existsSync(subtitlePath)) {
          fs.unlinkSync(subtitlePath);
        }
        reject(new Error(`Failed to start FFmpeg process: ${err.message}`));
      });
    });
  }
  
  /**
   * Create a picture-in-picture video with transcripts
   * @param mainVideoPath Path to the main video
   * @param pipVideoPath Path to the PIP video
   * @param segments Array of transcript segments
   * @param options Configuration options
   * @returns Promise resolving to the output file path
   */
  async createPipWithTranscript(
    mainVideoPath: string,
    pipVideoPath: string,
    segments: TranscriptSegment[],
    options: PipOptions = {}
  ): Promise<string> {
    // Set default options
    const {
      outputFileName = `pip_transcript_${uuidv4().substring(0, 8)}`,
      fontName = 'Arial',
      fontSize = 24,
      fontColor = 'white',
      backgroundColor = 'black@0.5',
      position = 'bottom',
      padding = 20,
      pipPosition = 'top-right',
      pipSize = 0.3
    } = options;
    
    // Create subtitle file
    const subtitlePath = await this._createSubtitleFile(segments);
    
    // Determine position parameters
    const positionParams = this._getPositionParameters(position, padding);
    
    // Determine PIP position
    const pipPositionParams = this._getPipPositionParameters(pipPosition, pipSize);
    
    // Output file path
    const outputPath = path.join(this.outputDir, `${outputFileName}.mp4`);
    
    return new Promise<string>((resolve, reject) => {
      // FFmpeg command to create PIP with subtitles
      const ffmpeg = spawn('ffmpeg', [
        '-i', mainVideoPath,
        '-i', pipVideoPath,
        '-i', subtitlePath,
        '-filter_complex', 
        `[0:v][1:v]${pipPositionParams}[pip];` +
        `[pip]subtitles=filename='${subtitlePath}':` +
        `fontsdir=.:force_style='FontName=${fontName},FontSize=${fontSize},` +
        `PrimaryColour=${this._colorToHex(fontColor)},BackColour=${this._colorToHex(backgroundColor)},` +
        `${positionParams}'[outv]`,
        '-map', '[outv]',
        '-map', '0:a',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'fast',
        '-y',
        outputPath
      ]);
      
      let stderrData = '';
      
      ffmpeg.stderr?.on('data', (data: Buffer) => {
        stderrData += data.toString();
      });
      
      ffmpeg.on('close', (code: number | null) => {
        // Clean up subtitle file
        fs.unlinkSync(subtitlePath);
        
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}: ${stderrData}`));
        }
      });
      
      ffmpeg.on('error', (err: Error) => {
        // Clean up subtitle file
        if (fs.existsSync(subtitlePath)) {
          fs.unlinkSync(subtitlePath);
        }
        reject(new Error(`Failed to start FFmpeg process: ${err.message}`));
      });
    });
  }
  
  /**
   * Create a subtitle file in SRT format
   * @param segments Array of transcript segments
   * @returns Promise resolving to the subtitle file path
   */
  private async _createSubtitleFile(segments: TranscriptSegment[]): Promise<string> {
    const subtitlePath = path.join(this.outputDir, `temp_subtitle_${uuidv4().substring(0, 8)}.srt`);
    let srtContent = '';
    
    segments.forEach((segment, index) => {
      const startTime = this._formatSrtTime(segment.start);
      const endTime = this._formatSrtTime(segment.end);
      
      srtContent += `${index + 1}\n`;
      srtContent += `${startTime} --> ${endTime}\n`;
      srtContent += `${segment.text}\n\n`;
    });
    
    return new Promise<string>((resolve, reject) => {
      fs.writeFile(subtitlePath, srtContent, (err) => {
        if (err) {
          reject(new Error(`Failed to create subtitle file: ${err.message}`));
        } else {
          resolve(subtitlePath);
        }
      });
    });
  }
  
  /**
   * Create a subtitle file with speaker names in SRT format
   * @param segments Array of transcript segments with speakers
   * @param speakerColor Color for speaker names
   * @returns Promise resolving to the subtitle file path
   */
  private async _createSpeakerSubtitleFile(
    segments: TranscriptSegment[],
    speakerColor: string
  ): Promise<string> {
    const subtitlePath = path.join(this.outputDir, `temp_speaker_subtitle_${uuidv4().substring(0, 8)}.ass`);
    let assContent = '[Script Info]\n';
    assContent += 'ScriptType: v4.00+\n';
    assContent += 'PlayResX: 384\n';
    assContent += 'PlayResY: 288\n';
    assContent += 'ScaledBorderAndShadow: yes\n\n';
    
    assContent += '[V4+ Styles]\n';
    assContent += 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n';
    assContent += `Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1\n\n`;
    
    assContent += '[Events]\n';
    assContent += 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
    
    segments.forEach((segment, index) => {
      const startTime = this._formatAssTime(segment.start);
      const endTime = this._formatAssTime(segment.end);
      const speakerText = segment.speaker ? `{\\c&H${this._colorToHex(speakerColor).substring(2)}\\b1}${segment.speaker}:{\\r} ` : '';
      
      assContent += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${speakerText}${segment.text}\n`;
    });
    
    return new Promise<string>((resolve, reject) => {
      fs.writeFile(subtitlePath, assContent, (err) => {
        if (err) {
          reject(new Error(`Failed to create subtitle file: ${err.message}`));
        } else {
          resolve(subtitlePath);
        }
      });
    });
  }
  
  /**
   * Format time for SRT format (00:00:00,000)
   * @param time Time string in format HH:MM:SS.mmm
   * @returns Formatted time string for SRT
   */
  private _formatSrtTime(time: string): string {
    // Replace the last dot with a comma for SRT format
    return time.replace(/\.(\d+)$/, ',$1');
  }
  
  /**
   * Format time for ASS format (0:00:00.00)
   * @param time Time string in format HH:MM:SS.mmm
   * @returns Formatted time string for ASS
   */
  private _formatAssTime(time: string): string {
    // Convert HH:MM:SS.mmm to H:MM:SS.mm (ASS format)
    const parts = time.split(':');
    const seconds = parts[2].split('.');
    const hours = parseInt(parts[0]);
    const milliseconds = seconds[1] ? seconds[1].substring(0, 2).padEnd(2, '0') : '00';
    
    return `${hours}:${parts[1]}:${seconds[0]}.${milliseconds}`;
  }
  
  /**
   * Convert color name to hex format
   * @param color Color name or hex string
   * @returns Hex color string
   */
  private _colorToHex(color: string): string {
    // Simple color name to hex conversion
    const colorMap: {[key: string]: string} = {
      'white': '&HFFFFFF',
      'black': '&H000000',
      'red': '&H0000FF',
      'green': '&H00FF00',
      'blue': '&HFF0000',
      'yellow': '&H00FFFF',
      'cyan': '&HFFFF00',
      'magenta': '&HFF00FF'
    };
    
    // If it's already a hex color or has transparency, return as is
    if (color.includes('&H') || color.includes('@')) {
      return color;
    }
    
    return colorMap[color.toLowerCase()] || '&HFFFFFF'; // Default to white
  }
  
  /**
   * Get position parameters for subtitles
   * @param position Position name (top, bottom, middle)
   * @param padding Padding in pixels
   * @returns Position parameters string
   */
  private _getPositionParameters(position: string, padding: number): string {
    switch (position.toLowerCase()) {
      case 'top':
        return `Alignment=8,MarginV=${padding}`;
      case 'middle':
        return 'Alignment=5';
      case 'bottom':
      default:
        return `Alignment=2,MarginV=${padding}`;
    }
  }
  
  /**
   * Get position parameters for picture-in-picture
   * @param position Position name (top-right, top-left, bottom-right, bottom-left)
   * @param size Size ratio (0.0 to 1.0)
   * @returns FFmpeg overlay filter string
   */
  private _getPipPositionParameters(position: string, size: number): string {
    const scaleFilter = `scale=iw*${size}:-1`;
    
    switch (position.toLowerCase()) {
      case 'top-left':
        return `${scaleFilter},overlay=10:10`;
      case 'top-right':
        return `${scaleFilter},overlay=main_w-overlay_w-10:10`;
      case 'bottom-left':
        return `${scaleFilter},overlay=10:main_h-overlay_h-10`;
      case 'bottom-right':
      default:
        return `${scaleFilter},overlay=main_w-overlay_w-10:main_h-overlay_h-10`;
    }
  }

  /**
   * Burn transcript with word-level highlighting onto a video
   * @param inputVideoPath Path to the input video
   * @param segments Array of transcript segments with word-level timing
   * @param options Configuration options
   * @returns Promise resolving to the output file path
   */
  async burnTranscriptWithWordHighlighting(
    inputVideoPath: string,
    segments: TranscriptSegment[],
    options: TranscriptOptions = {}
  ): Promise<string> {
    // Set default options
    const {
      outputFileName = `word_highlight_${uuidv4().substring(0, 8)}`,
      fontName = 'Arial',
      fontSize = 24,
      fontColor = 'white',
      backgroundColor = 'black@0.5',
      position = 'bottom',
      padding = 20,
      speakerColor = 'yellow'
    } = options;
    
    // Create subtitle file with word-level highlighting
    const subtitlePath = await this._createWordHighlightSubtitleFile(
      segments, 
      fontColor,
      speakerColor
    );
    
    // Output file path
    const outputPath = path.join(this.outputDir, `${outputFileName}.mp4`);
    const absoluteOutputPath = path.resolve(outputPath);
    
    return new Promise<string>((resolve, reject) => {
      // FFmpeg command to burn ASS subtitles
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputVideoPath,
        '-vf', `ass=${subtitlePath}`,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'fast',
        '-y',
        absoluteOutputPath
      ]);
      
      let stderrData = '';
      
      ffmpeg.stderr?.on('data', (data: Buffer) => {
        stderrData += data.toString();
      });
      
      ffmpeg.on('close', (code: number | null) => {
        // Clean up subtitle file
        // fs.unlinkSync(subtitlePath);
        
        if (code === 0) {
          resolve(absoluteOutputPath);
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}: ${stderrData}`));
        }
      });
      
      ffmpeg.on('error', (err: Error) => {
        // Clean up subtitle file
        if (fs.existsSync(subtitlePath)) {
          fs.unlinkSync(subtitlePath);
        }
        reject(new Error(`Failed to start FFmpeg process: ${err.message}`));
      });
    });
  }

  /**
   * Create an ASS subtitle file with word-level highlighting
   * @param segments Array of transcript segments with word timing
   * @param normalColor Color for non-highlighted text
   * @param highlightColor Color for highlighted words
   * @returns Promise resolving to the subtitle file path
   */
  private async _createWordHighlightSubtitleFile(
    segments: TranscriptSegment[],
    normalColor: string,
    speakerColor: string
  ): Promise<string> {
    const subtitlePath = path.join(this.outputDir, `temp_word_highlight_${uuidv4().substring(0, 8)}.ass`);
    const normalColorHex = this._colorToHex(normalColor).substring(2);
    const speakerColorHex = this._colorToHex(speakerColor).substring(2);
    const highlightColorHex = 'FFFF00'; // Yellow highlight by default
    
    // Create ASS header
    let assContent = '[Script Info]\n';
    assContent += 'ScriptType: v4.00+\n';
    assContent += 'PlayResX: 1280\n';
    assContent += 'PlayResY: 720\n';
    assContent += 'ScaledBorderAndShadow: yes\n\n';
    
    assContent += '[V4+ Styles]\n';
    assContent += 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n';
    assContent += `Style: Default,Arial,24,&H00${normalColorHex},&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,30,1\n\n`;
    
    assContent += '[Events]\n';
    assContent += 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
    
    for (const segment of segments) {
      // If no word-level timing, just add the whole segment
      if (!segment.words || segment.words.length === 0) {
        const startTime = this._formatAssTime(segment.start);
        const endTime = this._formatAssTime(segment.end);
        const speakerText = segment.speaker ? `{\\c&H${speakerColorHex}\\b1}${segment.speaker}:{\\r} ` : '';
        
        assContent += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${speakerText}${segment.text}\n`;
        continue;
      }
      
      // Add speaker name if available
      const speakerPrefix = segment.speaker ? `{\\c&H${speakerColorHex}\\b1}${segment.speaker}:{\\r} ` : '';
      
      // Process each word with its timing
      for (let i = 0; i < segment.words.length; i++) {
        const currentWord = segment.words[i];
        const startTime = this._formatAssTime(currentWord.start);
        const endTime = this._formatAssTime(currentWord.end);
        
        // Build the line with the current word highlighted
        let line = speakerPrefix;
        
        for (let j = 0; j < segment.words.length; j++) {
          if (j === i) {
            // Highlight the current word
            line += `{\\c&H${highlightColorHex}\\b1}${segment.words[j].word}{\\c&H${normalColorHex}\\b0} `;
          } else {
            // Normal color for other words
            line += `${segment.words[j].word} `;
          }
        }
        
        assContent += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${line.trim()}\n`;
      }
    }
    
    return new Promise<string>((resolve, reject) => {
      fs.writeFile(subtitlePath, assContent, (err) => {
        if (err) {
          reject(new Error(`Failed to create subtitle file: ${err.message}`));
        } else {
          resolve(subtitlePath);
        }
      });
    });
  }
}

export default TranscriptBurner; 