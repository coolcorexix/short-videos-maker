import json
import os

INPUT_FILE = "vietnamese_transcript.json"
AUDIO_DIR = "tts_audio_segments"
OUTPUT_FILE = "vietnamese_transcript_with_audio_path.json"

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    segments = json.load(f)

for i, seg in enumerate(segments):
    seg["audio_path"] = os.path.join(AUDIO_DIR, f"segment_{i:03d}.mp3")

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(segments, f, ensure_ascii=False, indent=2)

print(f"Transcript with audio paths saved to {OUTPUT_FILE}") 