import sys
import os
import subprocess
import whisper
import json
import ssl

ssl._create_default_https_context = ssl._create_unverified_context
os.environ['PYTHONHTTPSVERIFY'] = '0'

def download_youtube_video(url, output_dir="downloads"):
    os.makedirs(output_dir, exist_ok=True)
    # Try to determine the expected filename
    video_id = None
    if "v=" in url:
        video_id = url.split("v=")[-1].split("&")[0]
    elif "/shorts/" in url:
        video_id = url.split("/shorts/")[-1].split("?")[0].split("/")[0]
    else:
        raise ValueError("Could not extract video ID from URL: " + url)
    for ext in ["mp4", "mkv", "webm"]:
        path = os.path.join(output_dir, f"{video_id}.{ext}")
        if os.path.exists(path):
            print(f"Video already downloaded: {path}")
            return path
    # Fallback: check for any file with the video_id as prefix
    files = os.listdir(output_dir)
    for f in files:
        if f.startswith(video_id) and f.endswith((".mp4", ".mkv", ".webm")):
            path = os.path.join(output_dir, f)
            print(f"Video already downloaded: {path}")
            return path
    # Download best video+audio as mp4
    cmd = [
        "yt-dlp",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "-o", f"{output_dir}/%(id)s.%(ext)s",
        url
    ]
    subprocess.run(cmd, check=True)
    # Find the downloaded file
    for ext in ["mp4", "mkv", "webm"]:
        path = os.path.join(output_dir, f"{video_id}.{ext}")
        print(f"PHAT Downloaded video: {path}")
        if os.path.exists(path):
            return path
    # Fallback: return the first file in the folder
    files = os.listdir(output_dir)
    files = [f for f in files if f.endswith((".mp4", ".mkv", ".webm"))]
    if files:
        return os.path.join(output_dir, files[0])
    raise FileNotFoundError("Downloaded video not found.")

def transcribe_with_whisper(video_path, model_name="base"):
    model = whisper.load_model(model_name)
    result = model.transcribe(video_path)
    # Each segment has: start, end, text
    return result["segments"]

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 youtube_to_transcript.py <YouTube URL>")
        sys.exit(1)
    url = sys.argv[1]
    print("Downloading video...")
    video_path = download_youtube_video(url)
    print(f"Downloaded to: {video_path}")
    print("Transcribing with Whisper...")
    segments = transcribe_with_whisper(video_path)
    print(json.dumps(segments, indent=2, ensure_ascii=False))
    # Save to file
    with open("transcript.json", "w", encoding="utf-8") as f:
        json.dump(segments, f, indent=2, ensure_ascii=False)
    print("\nTranscript with timestamps saved to transcript.json") 