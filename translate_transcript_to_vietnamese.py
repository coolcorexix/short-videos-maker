import os
import json
import openai
import time
import requests

openai.api_key = os.getenv("OPENAI_API_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
url = "https://api.deepseek.com/v1/chat/completions"  # Example endpoint

INPUT_FILE = "transcript.json"
OUTPUT_FILE = "vietnamese_transcript.json"
MODEL = "gpt-3.5-turbo"

# Helper to translate a single text
def translate_text(text):
    payload = {
        "model": "deepseek-chat",  # or the specific model name
        "messages": [
            {"role": "system", "content": "You are a helpful translation assistant."},
            {"role": "user", "content": f"Translate this to Vietnamese:\n{text}"}
        ]
    }
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    response = requests.post(url, json=payload, headers=headers)
    print(response.json())
    return response.json()["choices"][0]["message"]["content"].strip()

if __name__ == "__main__":
    # Load transcript.json
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        segments = json.load(f)

    translated_segments = []
    for i, seg in enumerate(segments):
        print(f"Translating segment {i+1}/{len(segments)}...")
        vn_text = translate_text(seg["text"])
        new_seg = dict(seg)
        new_seg["text_vn"] = vn_text
        translated_segments.append(new_seg)
        time.sleep(1)  # To avoid rate limits

    # Save to vietnamese_transcript.json
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(translated_segments, f, ensure_ascii=False, indent=2)
    print(f"Vietnamese transcript saved to {OUTPUT_FILE}") 