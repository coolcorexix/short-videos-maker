import { analyzeTranscriptByChapters, extractVideoHighlightsV2, extractVideoHighlightsV3, HighlightInfo } from "./services/aiService.js";
import { getVideoChaptersWithTranscript } from "./services/transcriptService.js";
import { extractVideoId } from "./utils/helpers.js";
import VideoClipper from "./utils/videoClipper.js";
import WhisperTranscriber from "./utils/whisperTranscriber.js";
import youtubeDownloader from "./utils/youtubeDownloader.js";
import TimeUtils from "./utils/timeUtils.js";
import TranscriptBurner, { TranscriptSegment } from "./utils/transcriptBurner.js";
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const inputYoutubeVideoUrl = 'https://www.youtube.com/watch?v=lIo9FcrljDk';
    while (false) {
        const videoId = extractVideoId(inputYoutubeVideoUrl);
        const transcriptsNestedInChapter = await getVideoChaptersWithTranscript(videoId);
        const firstThreeChapters = transcriptsNestedInChapter.chapters.slice(0, 1);
        const question = 'show me a highlight in this chapter so I can make a short videos from it and also include the related transcript';
        const highlights = await extractVideoHighlightsV3({
            ...transcriptsNestedInChapter,
            chapters: firstThreeChapters
        });
    }
    
    const sampleHighlights: HighlightInfo[] = JSON.parse(`[
    {
        "highlightTitle": "Introduction to Sleep Science",
        "caption": "Andrew Huberman introduces the episode's focus on sleep and wakefulness as critical factors for mental/physical health and performance.",
        "startTime": "00:00:17",
        "endTime": "00:00:21"
    },
    {
        "highlightTitle": "Sleep-Wake Cycle Connection",
        "caption": "Explains how sleep and wakefulness are interconnected phases that govern overall health, emphasizing their bidirectional importance.",
        "startTime": "00:00:25",
        "endTime": "00:00:33"
    },
    {
        "highlightTitle": "Tool-Focused Approach",
        "caption": "Preview of actionable tools to improve sleep quality, fall asleep faster, and optimize sleep timing for better recovery.",
        "startTime": "00:00:37",
        "endTime": "00:00:43"
    },
    {
        "highlightTitle": "Universal Sleep Struggles",
        "caption": "Acknowledges common sleep challenges faced by most people, creating relatability and urgency to explore solutions.",
        "startTime": "00:00:52",
        "endTime": "00:00:58"
    },
    {
        "highlightTitle": "Outcome-Driven Solutions",
        "caption": "Final promise of practical strategies to not only sleep better but also wake up feeling genuinely refreshed.",
        "startTime": "00:01:07",
        "endTime": "00:01:11"
    }
    ]`);

    try {
        console.log("Downloading video...");
        const sourceVideo = await youtubeDownloader.downloadVideo(inputYoutubeVideoUrl);
        console.log(`Video downloaded: ${sourceVideo}`);
        
        const videoClipper = new VideoClipper();
        
        for (const highlight of sampleHighlights) {
            console.log(`Processing highlight: ${highlight.highlightTitle}`);
            
            // Convert timestamp to seconds if needed
            const startTime = highlight.startTime;
            const endTime = highlight.endTime;
            
            // Calculate duration
            const startSeconds = TimeUtils.timestampToSeconds(startTime);
            const endSeconds = TimeUtils.timestampToSeconds(endTime);
            const duration = endSeconds - startSeconds;
            
            console.log(`Cutting from ${startTime} for ${duration} seconds`);
            
            try {
                const clippedHighlight = await videoClipper.cutVideo(
                    sourceVideo, 
                    startTime,
                    duration,
                    { outputFileName: highlight.highlightTitle.replace(/\s+/g, '_') }
                );
                console.log(`Clip created: ${clippedHighlight}`);
            } catch (error) {
                console.error(`Error creating clip for ${highlight.highlightTitle}:`, error);
            }
        }
    } catch (error) {
        console.error("Error in main process:", error);
    }
}

async function addTranscriptToHighlight() {
    const clipPath = 'clips/Introduction_to_Sleep_Science.mp4';
    const whisperTranscriber = new WhisperTranscriber();
    const transcriptBurner = new TranscriptBurner('output');
    
    try {
        // Load the transcript from the JSON file
        const transcriptFile = './transcripts/whisper_audio_Introduction_to_Sleep_Science.json';
        
        if (!fs.existsSync(transcriptFile)) {
            console.error(`Transcript file not found: ${transcriptFile}`);
            return;
        }
        
        const rawTranscript = JSON.parse(fs.readFileSync(transcriptFile, 'utf8'));
        console.log(`Loaded transcript with ${rawTranscript.segments.length} segments`);
        
        // Convert to TranscriptSegment format
        const segments: TranscriptSegment[] = rawTranscript.segments.map((segment: any) => ({
            start: TimeUtils.secondsToTimestamp(segment.start)+'.000',
            end: TimeUtils.secondsToTimestamp(segment.end)+'.000',
            text: segment.text.trim(),
            words: segment.words.map((word: any) => ({
                word: word.word,
                start: TimeUtils.secondsToTimestamp(word.start)+'.000',
                end: TimeUtils.secondsToTimestamp(word.end)+'.000'
            }))
        }));
        
        // Filter segments to only include those within the clip duration
        // Get clip duration using ffprobe
        const clipDuration = await getVideoDuration(clipPath);
        console.log(`Clip duration: ${clipDuration} seconds`);
        
        // Filter segments that fall within the clip duration
        const relevantSegments = segments.filter(segment => {
            const startSeconds = TimeUtils.timestampToSeconds(segment.start);
            return startSeconds < clipDuration;
        });
        
        console.log(`Found ${relevantSegments.length} relevant transcript segments for the clip`);
        
        // Adjust timestamps to start from 0
        const adjustedSegments = relevantSegments.map(segment => ({
            start: TimeUtils.secondsToTimestamp(0)+'.000', // Start at beginning of clip
            end: TimeUtils.secondsToTimestamp(
                Math.min(
                    TimeUtils.timestampToSeconds(segment.end) - TimeUtils.timestampToSeconds(relevantSegments[0].start),
                    clipDuration
                )
            )+'.000',
            text: segment.text,
            words: segment.words.map((word: any) => ({
                word: word.word,
                start: TimeUtils.secondsToTimestamp(word.start)+'.000',
                end: TimeUtils.secondsToTimestamp(word.end)+'.000'
            }))
        }));
        
        // Burn the transcript onto the video
        console.log("Burning transcript to video...");
        const outputPath = await transcriptBurner.burnTranscriptWithWordHighlighting(
            clipPath,
            segments,
            {
                outputFileName: 'Introduction_to_Sleep_Science_with_transcript',
                fontName: 'Arial',
                fontSize: 24,
                fontColor: 'white',
                backgroundColor: 'black@0.6',
                position: 'bottom',
                padding: 20
            }
        );
        
        console.log(`Video with transcript created: ${outputPath}`);
        
        // Also create a version with fancy styling
        console.log("Creating styled version...");
        const styledOutputPath = await transcriptBurner.burnTranscripts(
            clipPath,
            adjustedSegments,
            {
                outputFileName: 'Introduction_to_Sleep_Science_styled',
                fontName: 'Arial',
                fontSize: 28,
                fontColor: 'white',
                backgroundColor: 'black@0.7',
                position: 'bottom',
                padding: 30
            }
        );
        
        console.log(`Styled video created: ${styledOutputPath}`);
        
    } catch (error) {
        console.error("Error processing transcript:", error);
    }
}

// Helper function to get video duration using ffprobe
async function getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const { spawn } = require('child_process');
        const ffprobe = spawn('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            videoPath
        ]);
        
        let output = '';
        
        ffprobe.stdout.on('data', (data: Buffer) => {
            output += data.toString();
        });
        
        ffprobe.on('close', (code: number) => {
            if (code === 0) {
                resolve(parseFloat(output.trim()));
            } else {
                reject(new Error(`ffprobe process exited with code ${code}`));
            }
        });
        
        ffprobe.on('error', (err: Error) => {
            reject(new Error(`Failed to start ffprobe process: ${err.message}`));
        });
    });
}

// Function to create a highlight with transcript in one step
async function createHighlightWithTranscript(
    sourceVideo: string,
    highlight: HighlightInfo,
    transcriptData: any
) {
    try {
        const videoClipper = new VideoClipper();
        const transcriptBurner = new TranscriptBurner('output');
        
        console.log(`Processing highlight: ${highlight.highlightTitle}`);
        
        // Convert timestamp to seconds
        const startTime = highlight.startTime;
        const endTime = highlight.endTime;
        
        // Calculate duration
        const startSeconds = TimeUtils.timestampToSeconds(startTime);
        const endSeconds = TimeUtils.timestampToSeconds(endTime);
        const duration = endSeconds - startSeconds;
        
        // Cut the clip
        const clipFileName = highlight.highlightTitle.replace(/\s+/g, '_');
        const clipPath = await videoClipper.cutVideo(
            sourceVideo, 
            startTime,
            duration,
            { outputFileName: clipFileName }
        );
        
        // Convert transcript segments to our format
        const allSegments: TranscriptSegment[] = transcriptData.segments.map((segment: any) => ({
            start: TimeUtils.secondsToTimestamp(segment.start),
            end: TimeUtils.secondsToTimestamp(segment.end),
            text: segment.text.trim()
        }));
        
        // Filter segments that fall within the highlight timeframe
        const relevantSegments = allSegments.filter(segment => {
            const segStartSeconds = TimeUtils.timestampToSeconds(segment.start);
            const segEndSeconds = TimeUtils.timestampToSeconds(segment.end);
            
            return (
                (segStartSeconds >= startSeconds && segStartSeconds < endSeconds) ||
                (segEndSeconds > startSeconds && segEndSeconds <= endSeconds) ||
                (segStartSeconds <= startSeconds && segEndSeconds >= endSeconds)
            );
        });
        
        // Adjust timestamps to be relative to the clip
        const adjustedSegments = relevantSegments.map(segment => ({
            start: TimeUtils.secondsToTimestamp(
                Math.max(0, TimeUtils.timestampToSeconds(segment.start) - startSeconds)
            ),
            end: TimeUtils.secondsToTimestamp(
                Math.min(duration, TimeUtils.timestampToSeconds(segment.end) - startSeconds)
            ),
            text: segment.text
        }));
        
        // Burn the transcript onto the video
        const outputPath = await transcriptBurner.burnTranscripts(
            clipPath,
            adjustedSegments,
            {
                outputFileName: `${clipFileName}_with_transcript`,
                fontName: 'Arial',
                fontSize: 24,
                fontColor: 'white',
                backgroundColor: 'black@0.6',
                position: 'bottom',
                padding: 20
            }
        );
        
        console.log(`Highlight with transcript created: ${outputPath}`);
        return outputPath;
        
    } catch (error) {
        console.error(`Error creating highlight with transcript: ${error}`);
        throw error;
    }
}

// Run the transcript burning function
addTranscriptToHighlight().catch(error => {
    console.error("Unhandled error:", error);
});

