import os
import json
import subprocess
from pydub import AudioSegment

VIDEO_PATH = "downloads/-8ZLWtNHFjc.mp4"
TRANSCRIPT_JSON = "vietnamese_transcript_with_audio_path.json"
OUTPUT_VIDEO = "video_with_vietnamese_audio.mp4"
TEMP_AUDIO = "temp_vn_audio.mp3"

def get_audio_duration(audio_path):
    audio = AudioSegment.from_file(audio_path)
    return len(audio) / 1000.0  # seconds

def main():
    # Load transcript
    with open(TRANSCRIPT_JSON, "r", encoding="utf-8") as f:
        segments = json.load(f)

    # Concatenate TTS segments with silence padding to match timestamps
    combined = AudioSegment.silent(duration=0)
    last_end = 0.0
    for seg in segments:
        start = float(seg["start"])
        end = float(seg["end"])
        audio_path = seg["audio_path"]
        # Add silence if needed
        if start > last_end:
            silence = AudioSegment.silent(duration=int((start - last_end) * 1000))
            combined += silence
        # Add TTS audio
        tts_audio = AudioSegment.from_file(audio_path)
        combined += tts_audio
        # get the duration of the tts audio
        tts_duration = get_audio_duration(audio_path)
        print(f"TTS duration: {tts_duration}")
        # add a silence to the end of the audio
        silence = AudioSegment.silent(duration=int((end - start - tts_duration) * 1000))
        print(f"Silence duration: {silence.duration_seconds}")
        combined += silence
        last_end = end

    # Optionally, pad to the end of the video (get video duration with ffprobe if needed)
    combined.export(TEMP_AUDIO, format="mp3")
    print(f"Combined TTS audio exported to {TEMP_AUDIO}")

    # --- Generate SRT subtitle file from text_vn ---
    def seconds_to_srt_time(seconds):
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds - int(seconds)) * 1000)
        return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"

    SRT_PATH = "vietnamese_subs.srt"
    with open(SRT_PATH, "w", encoding="utf-8") as srt_file:
        for idx, seg in enumerate(segments):
            start = seconds_to_srt_time(float(seg["start"]))
            end = seconds_to_srt_time(float(seg["end"]))
            text_vn = seg.get("text_vn", "")
            srt_file.write(f"{idx+1}\n{start} --> {end}\n{text_vn}\n\n")
    print(f"SRT subtitles exported to {SRT_PATH}")

    # Replace video audio with new audio and burn in subtitles using ffmpeg
    cmd = [
        "ffmpeg",
        "-y",
        "-i", VIDEO_PATH,
        "-i", TEMP_AUDIO,
        "-c:v", "libx264",
        "-vf", f"subtitles={SRT_PATH}",
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-shortest",
        OUTPUT_VIDEO
    ]
    print("Running ffmpeg to mux new audio and burn subtitles...")
    subprocess.run(cmd, check=True)
    print(f"Output video with Vietnamese audio and subtitles: {OUTPUT_VIDEO}")

if __name__ == "__main__":
    main()