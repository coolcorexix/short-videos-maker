import os
import json
import requests
import time
import base64

ZALO_API_KEY = os.getenv("ZALO_API_KEY")
ZALO_TTS_URL = "https://api.zalo.ai/v1/tts/synthesize"
INPUT_FILE = "vietnamese_transcript.json"
AUDIO_DIR = "tts_audio_segments"
OUTPUT_AUDIO = "vietnamese_speech.mp3"

os.makedirs(AUDIO_DIR, exist_ok=True)

# Helper to synthesize speech for a single text
def synthesize_speech(text, idx):
    headers = {
        "apikey": ZALO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded"
    }
    print(text)
    payload = {
        "input": text,
        "encode_type": 1,
        "speaker_id": 3,
    }
    response = requests.post(ZALO_TTS_URL, headers=headers, data=payload)
    if response.status_code == 200:
        result = response.json()
        if result.get("data") and result["data"].get("url"):
            # Download the audio file from the returned URL
            audio_url = result["data"]["url"]
            audio_response = requests.get(audio_url)
            # print keys of audio_response
            print('audio_response: ', audio_response.status_code)
            
            if audio_response.status_code == 200:
                audio_path = os.path.join(AUDIO_DIR, f"segment_{idx:03d}.mp3")
                print(f"Downloaded audio to {audio_path}")
                with open(audio_path, "wb") as f:
                    f.write(audio_response.content)
                return audio_path
            else: 
                print('audio_response: ', audio_response.content)
                print(f"Failed to download audio for segment {idx}")
        else:
            print(f"No audio URL in response for segment {idx}")
    else:
        print(f"Zalo TTS API error for segment {idx}: {response.text}")
    return None

if __name__ == "__main__":
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        segments = json.load(f)

    audio_files = []
    for i, seg in enumerate(segments):
        text_vn = seg.get("text_vn", "").strip()
        if i != 2 and i != 3:
            continue
        if not text_vn:
            continue
        print(f"Synthesizing speech for segment {i+1}/{len(segments)}...")
        audio_path = synthesize_speech(text_vn, i)
        if audio_path:
            audio_files.append(audio_path)
        time.sleep(1)  # To avoid rate limits

    print(f"Generated {len(audio_files)} audio segments in {AUDIO_DIR}/")

    # Add audio_path to each segment and save to new JSON file
    OUTPUT_JSON = "vietnamese_transcript_with_audio_path.json"
    for i, seg in enumerate(segments):
        seg["audio_path"] = os.path.join(AUDIO_DIR, f"segment_{i:03d}.mp3")
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)
    print(f"Transcript with audio paths saved to {OUTPUT_JSON}") 