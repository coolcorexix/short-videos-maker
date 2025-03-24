// AI service interactions
import { deepseek, createDeepSeek } from '@ai-sdk/deepseek';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import config from '../config/config.js';
import { TranscriptSegment } from '../utils/transcriptBurner.js';
import TimeUtils from '../utils/timeUtils.js';
import cacheUtils from '../utils/cacheUtils.js';

// Define types for our functions and data
interface DeepSeekResponse {
  response: string;
  model: string;
  usage: any;
  reasoning?: string;
}

interface ChapterAnalysis {
  chapterTitle: string;
  startTime: string;
  duration: string;
  analysis: string;
}

interface AnalysisResult {
  chapterAnalyses: ChapterAnalysis[];
  overallAnalysis: string | null;
}

interface VideoSegment {
  text: string;
  start: number;
  duration: number;
}

interface Chapter {
  title: string;
  start: number;
  startFormatted: string;
  end?: number;
  durationFormatted?: string;
  segments: VideoSegment[];
}

interface VideoData {
  videoId: string;
  title: string;
  channelTitle: string;
  chapters: Chapter[];
  plainTranscript: string;
}

export interface HighlightInfo {
  highlightTitle: string;
  caption: string;
  startTime?: string;
  endTime?: string;
}

// Initialize DeepSeek client
function getDeepSeekClient() {
  if (!config.deepseekApiKey) {
    throw new Error('DeepSeek API key not configured');
  }

  return createDeepSeek({
    apiKey: config.deepseekApiKey
  });
}

// Send prompt to DeepSeek
export async function sendPrompt(
  prompt: string,
  modelName: string = 'deepseek-reasoner',
  temperature: number = 0.7
): Promise<DeepSeekResponse> {
  try {
    const client = getDeepSeekClient();

    const result = await generateText({
      model: client(modelName),
      prompt: prompt,
      temperature: temperature
    });

    return {
      response: result.text,
      model: modelName,
      usage: result.providerMetadata?.deepseek || {},
      reasoning: result.reasoning
    };
  } catch (error) {
    console.error('Error calling DeepSeek API:', error);
    throw error;
  }
}

// Analyze transcript by chapters
export async function analyzeTranscriptByChapters(
  videoData: VideoData,
  question: string
): Promise<AnalysisResult> {
  try {
    const client = getDeepSeekClient();
    const chapterAnalyses: ChapterAnalysis[] = [];

    for (const chapter of videoData.chapters) {
      // Skip chapters with no transcript segments
      if (chapter.segments.length === 0) continue;

      // Format chapter transcript as plain text
      const chapterText = chapter.segments.map(segment => segment.text).join(' ');

      // Prepare prompt for DeepSeek
      const prompt = `
        I have the following transcript from a section of a YouTube video titled "${videoData.title}".
        
        Section: "${chapter.title}" (${chapter.startFormatted} - Duration: ${chapter.durationFormatted})
        
        Transcript:
        ${chapterText.substring(0, 4000)}
        ${chapterText.length > 4000 ? '... (transcript truncated)' : ''}
        
        Based on this section of the transcript, please ${question}
      `;

      // Send prompt to DeepSeek using the AI SDK
      const result = await generateText({
        model: client('deepseek-coder'),
        prompt: prompt,
        temperature: 0.3
      });

      chapterAnalyses.push({
        chapterTitle: chapter.title,
        startTime: chapter.startFormatted,
        duration: chapter.durationFormatted || '0:00',
        analysis: result.text
      });
    }

    // // If there are multiple chapters, also do a summary analysis of the whole video
    // let overallAnalysis: string | null = null;
    // if (videoData.chapters.length > 1) {
    //   // Prepare prompt for overall analysis
    //   const prompt = `
    //     I have the following transcript from a YouTube video titled "${videoData.title}".

    //     ${videoData.plainTranscript.substring(0, 6000)}
    //     ${videoData.plainTranscript.length > 6000 ? '... (transcript truncated)' : ''}

    //     Based on this transcript, please provide a brief overall ${question}
    //   `;

    //   const result = await sendPrompt(prompt, 'deepseek-reasoner', 0.7);
    // overallAnalysis = result.response;
    let overallAnalysis = '';
    // }

    return {
      chapterAnalyses,
      overallAnalysis
    };
  } catch (error) {
    console.error('Error analyzing transcript:', error);
    throw error;
  }
}


export async function extractVideoHighlightsV3(
  videoData: VideoData,
  maxAge: number = 3600 // Cache for 1 hour by default
): Promise<HighlightInfo[]> {
  // Check cache first
  const cacheKey = { service: 'extractVideoHighlightsV3', videoId: videoData.videoId };
  const cachedResult = cacheUtils.get<HighlightInfo[]>(cacheKey, maxAge);
  if (cachedResult) {
    return cachedResult;
  }
  try {
    const client = getDeepSeekClient();
    for (const chapter of videoData.chapters) {
      const prompt = `
      show me highlights in this chapter so I can make a short videos ranging from 30s to 90s from it. For each highlight, return the start time, duration, and a summary of the highlight.
      ${
        chapter.segments.map(segment => `
          ${JSON.stringify(segment)}
        `).join('\n')
      }

      Return your response as a valid JSON object array with the following structure:
      [
        {
          "hightlightTitle": "string",
          "Summary": "string",
          "startTime": the start time of the first related transcript,
          "duration": the duration of the highlight,
        }
      ]
      `
      const result = await generateText({
        model: client('deepseek-reasoner'),
        prompt: prompt,
        temperature: 0.7,
      });
      console.log('🚀 ~ result:', result.response.messages);
      const textMessage = result.response.messages[0].content.find(
        (content: any) => content.type === 'text'
      ).text;
      console.log('🚀 ~ result:', textMessage);
      const highlights: HighlightInfo[] = JSON.parse(textMessage.replace(/```json\n/, '').replace(/\n```/, '')); 
      cacheUtils.set(cacheKey, highlights);
      return highlights;
    }

  } catch (error) {
    console.error('Error extracting video highlights:', error);
    throw error;
  }
}

/**
 * Analyze a video transcript to identify highlight moments using function calling with Zod
 */
export async function extractVideoHighlightsV2(
  videoData: VideoData,
  highlightCount: number = 3
): Promise<HighlightInfo[]> {
  try {
    // Check cache first (cache for 1 hour during development)
    const cacheKey = { 
      service: 'extractHighlights', 
      videoId: videoData.videoId,
      highlightCount,
      // Include a version number to invalidate cache when you change the algorithm
      version: '1.0'
    };
    const cachedData = cacheUtils.get<HighlightInfo[]>(cacheKey, 3600);
    
    if (cachedData) {
      console.log(`Using cached highlights for ${videoData.videoId}`);
      return cachedData;
    }
    
    console.log(`Generating highlights for ${videoData.videoId}`);
    
    const client = getDeepSeekClient();

    // Define schema with Zod
    const highlightSchema = z.object({
      highlightTitle: z.string().describe("A catchy title for the highlight (5-8 words)"),
      caption: z.string().describe("A brief caption describing why this moment is interesting (15-25 words)"),
      transcriptText: z.string().describe("The exact transcript text that corresponds to this highlight")
    });

    // Define the tool with Zod schema
    const tools = {
      createHighlight: tool({
        description: "Create a highlight from a video transcript",
        parameters: highlightSchema,
        execute: async (args) => {
          // This function will be called when the model uses this tool
          return args;
        }
      })
    };

    // Prepare prompt for DeepSeek
    const prompt = `
      I have a transcript from a YouTube video titled "${videoData.title}".
      
      Transcript:
      ${videoData.plainTranscript.substring(0, 8000)}
      ${videoData.plainTranscript.length > 8000 ? '... (transcript truncated)' : ''}
      
      Please identify the ${highlightCount} most interesting or important moments from this video.
      For each highlight, call the createHighlight function with:
      1. A catchy title (5-8 words)
      2. A brief caption describing why this moment is interesting (15-25 words)
      3. The exact transcript text that corresponds to this highlight
    `;

    // Track the highlights
    const highlights: HighlightInfo[] = [];

    // Use the AI SDK with function calling
    const result = await generateText({
      model: client('deepseek-chat'),
      prompt: prompt,
      temperature: 0.7,
      tools,
    });

    // Process the tool calls from the result
    if (result.toolCalls && result.toolCalls.length > 0) {
      // Process each tool call
      for (const call of result.toolCalls) {
        if (call.type === "tool-call" && call.toolName === "createHighlight" && call.args) {
          // Find the transcript segments that match this highlight
          const transcriptText = call.args.transcriptText;
          const relatedSegments = findRelatedTranscriptSegments(videoData.chapters, transcriptText);

          if (relatedSegments.length > 0) {
            highlights.push({
              highlightTitle: call.args.highlightTitle,
              caption: call.args.caption,
              relatedTranscripts: relatedSegments,
              startTime: relatedSegments[0].start,
              endTime: relatedSegments[relatedSegments.length - 1].end
            });
          }
        }
      }
    } else {
      // Fallback to regex parsing if no tool calls were detected
      const functionCalls = extractFunctionCalls(result.text);

      // Process each function call from regex parsing
      for (const call of functionCalls) {
        if (call.name === "createHighlight" && call.arguments) {
          const args = call.arguments;

          // Find the transcript segments that match this highlight
          const transcriptText = args.transcriptText;
          const relatedSegments = findRelatedTranscriptSegments(videoData.chapters, transcriptText);

          if (relatedSegments.length > 0) {
            // Calculate start and end times
            const startTime = relatedSegments[0].start;
            const endTime = relatedSegments[relatedSegments.length - 1].end;

            highlights.push({
              highlightTitle: args.highlightTitle,
              caption: args.caption,
              relatedTranscripts: relatedSegments,
              startTime: startTime,
              endTime: endTime
            });
          }
        }
      }
    }

    // Save results to cache before returning
    cacheUtils.set(cacheKey, highlights);
    
    return highlights;
  } catch (error) {
    console.error('Error extracting video highlights:', error);
    throw error;
  }
}

/**
 * Extract function calls from AI response text
 * @param text Response text from AI
 * @returns Array of function calls with name and arguments
 */
function extractFunctionCalls(text: string): Array<{ name: string, arguments: any }> {
  const functionCalls = [];

  // Look for patterns like: createHighlight({ ... })
  const regex = /createHighlight\s*\(\s*(\{[\s\S]*?\})\s*\)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    try {
      const argsStr = match[1];
      const args = JSON.parse(argsStr);

      functionCalls.push({
        name: "createHighlight",
        arguments: args
      });
    } catch (error) {
      console.error('Error parsing function call:', error);
    }
  }

  // If no function calls were found using the regex, try to parse the entire response as JSON
  if (functionCalls.length === 0) {
    try {
      // Look for JSON objects in the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const args = JSON.parse(jsonMatch[0]);
        functionCalls.push({
          name: "createHighlight",
          arguments: args
        });
      }
    } catch (error) {
      console.error('Error parsing JSON from response:', error);
    }
  }

  return functionCalls;
}

/**
 * Find transcript segments that match a given text
 * @param chapters Video chapters with transcript segments
 * @param text Text to search for
 * @returns Array of matching transcript segments
 */
function findRelatedTranscriptSegments(
  chapters: Chapter[],
  text: string
): TranscriptSegment[] {
  const allSegments: VideoSegment[] = [];

  // Collect all segments from all chapters
  chapters.forEach(chapter => {
    allSegments.push(...chapter.segments);
  });

  // Create a simplified version of the text for matching
  const simplifiedText = text.toLowerCase().replace(/[^\w\s]/g, '');

  // Find segments that contain parts of the text
  const words = simplifiedText.split(/\s+/).filter(word => word.length > 3);

  // Score each segment based on how many words it contains from the text
  const scoredSegments = allSegments.map(segment => {
    const simplifiedSegment = segment.text.toLowerCase().replace(/[^\w\s]/g, '');
    let score = 0;

    words.forEach(word => {
      if (simplifiedSegment.includes(word)) {
        score++;
      }
    });

    return { segment, score };
  });

  // Sort by score (descending) and filter out segments with no matches
  const matchingSegments = scoredSegments
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.segment);

  // Convert VideoSegment to TranscriptSegment format
  return matchingSegments.map(segment => ({
    start: TimeUtils.secondsToTimestamp(segment.start),
    end: TimeUtils.secondsToTimestamp(segment.start + segment.duration),
    text: segment.text
  }));
} 