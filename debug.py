import requests

audio_url = "https://chunk-v3.tts.zalo.ai/secure/e8fec4cf8abf63e13aae/e8fec4cf8abf63e13aae.mp3?expires=1748256896&md5=DVfuLk_HDxupZSlYEcBh8A"
response = requests.get(audio_url)
# save response to file
with open("audio.mp3", "wb") as f:
    f.write(response.content)

