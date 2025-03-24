
import sys
import json
import whisper

try:
    # Load model
    model = whisper.load_model("tiny")
    
    # Transcribe
    result = model.transcribe(
        "temp/audio_Introduction_to_Sleep_Science.wav",
        language="en",
        task="transcribe",
        verbose=False,
        word_timestamps=True
    )
    
    # Save result
    with open("transcripts/whisper_audio_Introduction_to_Sleep_Science.json", "w") as f:
        json.dump(result, f, indent=2)
    
    print("Transcription complete")
    sys.exit(0)
except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    sys.exit(1)
