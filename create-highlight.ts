import VideoClipper from "./utils/videoClipper.js";

import sampleResponse from './sample/sampleAIResponse.json' assert { type: 'json' };
import sampleCombinedResponse from './sample/sampleResponseOfCombined.json' assert { type: 'json' };
import TranscriptBurner, { TranscriptSegment } from "./utils/transcriptBurner.js";
import TimeUtils from "./utils/timeUtils.js";
import { decodeHtmlEntities } from "./utils/htmlEntityDecoder.js";

// console.log("🚀 ~ sampleResponse:", sampleResponse)

const inputYoutubeVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const transcriptsNestedInChapter = getVideoChaptersWithTranscript(inputYoutubeVideoUrl);
const hightlightAnalysis: {
  chapterTitle: string;
  highlightStartTime: number;
  hightlightDuration: number;
  relatedTranscript: TranscriptSegment[];
} = getHightlightAnalysis(transcriptsNestedInChapter);
const highlightClips = getHighlightClips(hightlightAnalysis);

async function createHighlightClip() {
  const start = 1037.919;
  const end = start + 26.401;
  const relatedTranscripts = sampleCombinedResponse.chapters.find((chapter) => chapter.title.includes('State of autonomous robots'))?.segments.filter((segment) => segment.start >= start && segment.start <= end);
  if (!relatedTranscripts) {
    console.error('No related transcripts found');
    return;
  }
  const formattedTranscripts = relatedTranscripts.map((segment) => ({
    start: TimeUtils.secondsToTimestamp(segment.start - start)+'.000',
    end: TimeUtils.secondsToTimestamp(segment.start + segment.duration - start)+'.000',
    text: decodeHtmlEntities(segment.text),
  }));
  
  console.log("🚀 ~ formattedTranscripts ~ formattedTranscripts:", formattedTranscripts)
  try {
    const clipper = new VideoClipper('./public/clips');
    const burner = new TranscriptBurner('.');

    burner.burnTranscripts('./public/clips/highlight_clip_1.mp4', formattedTranscripts,      {
      fontName: 'Arial',
      fontSize: 28,
      fontColor: 'white',
      backgroundColor: 'black@0.6',
      position: 'bottom',
      padding: 30
    });
    
    // sampleResponse.chapterAnalyses
    // .filter((chapter, index) => !index)
    // .forEach(async (chapter) => {
    //   console.log("🚀 ~ chapter:", chapter)
    //   const endTime = TimeUtils.addDuration(chapter.startTime, chapter.duration);
    //   console.log("🚀 ~ sampleResponse.chapterAnalyses.forEach ~ chapter.duration:", chapter.duration)
    //   console.log("🚀 ~ sampleResponse.chapterAnalyses.forEach ~ chapter.startTime:", chapter.startTime)
    //   console.log("🚀 ~ sampleResponse.chapterAnalyses.forEach ~ endTime:", endTime)
    //   const clip = await clipper.cutVideo(
    //     './sample/sample.mp4',
    //     chapter.startTime,
    //     endTime,
    //     `highlight_clip_${chapter.chapterTitle}`
    //   );
    //   console.log("🚀 ~ clip:", clip.filePath)

    // })

  // const clip = await clipper.cutVideo(
    //   './sample/sample.mp4',
    //   start,
    //   end,
    //   'highlight_clip_1'
    // );
    // burn these transcripts into video highlight_clip_1.mp4

    // Generate a thumbnail from the video
    // const thumbnail = await clipper.generateThumbnail(
    //   './sample/sample.mp4',
    //   '00:05:45',                           // Time position for thumbnail
    //   'highlight_thumbnail'                 // Output filename
    // );

    // console.log('Thumbnail created:', thumbnail);

  } catch (error) {
    console.error('Error creating video clip:', error);
  }
}

createHighlightClip();
