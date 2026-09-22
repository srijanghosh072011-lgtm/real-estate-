"""Generate the game's voice lines with the open-source Kokoro TTS model.

Reads js/lines.js (the same file the game shows as subtitles), renders every line with the voice cast
below, applies per-character effects with ffmpeg, and packs the clips into a few MP3 "banks" plus
js/voice-manifest.js (bank + start/duration per line id).

Usage: python3 tools/gen_voices.py --model kokoro.onnx --voices voices.npz
Needs: pip install kokoro-onnx soundfile imageio-ffmpeg
"""
import argparse, json, os, re, subprocess, tempfile
import numpy as np, soundfile as sf, imageio_ffmpeg
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 24000
NORM = "loudnorm=I=-17:TP=-1.5:LRA=9"

# voice, speed, ffmpeg filter (None = clean)
DEMON = ("[0:a]rubberband=pitch=0.88:formant=preserved,asplit[a][b];[b]rubberband=pitch=0.5,volume=0.26[c];"
         "[a][c]amix=inputs=2:normalize=0,bass=g=4:f=120,aecho=0.8:0.55:45|90:0.22|0.1," + NORM)
CAST = {
    "n":        (("af_heart",), 0.94, "aecho=0.8:0.6:40:0.08," + NORM),
    "gojo":     (("am_puck",), 1.02, "aecho=0.8:0.5:30:0.06," + NORM),
    "sukuna":   (("am_onyx", "am_michael"), 0.9, DEMON),
    "sukunah":  (("am_onyx", "am_michael"), 0.88, DEMON),
    "yuji":     (("am_fenrir",), 1.05, NORM),
    "yuta":     (("am_liam",), 0.95, NORM),
    "kashimo":  (("am_echo",), 1.08, NORM),
    "higuruma": (("bm_george",), 0.92, NORM),
    "maki":     (("bf_emma",), 1.02, NORM),
    "todo":     (("bm_lewis",), 1.0, "rubberband=pitch=0.95:formant=preserved,bass=g=3," + NORM),
}


def load_lines():
    src = open(os.path.join(ROOT, "js", "lines.js"), encoding="utf-8").read()
    data = json.loads(re.sub(r";\s*$", "", src.split("=", 1)[1].strip()))
    banks = {}
    for ch in data["story"]:
        for part in ("intro", "win", "lose"):
            for ln in ch[part]:
                if "id" in ln:
                    banks.setdefault(ch["id"], []).append((ln["id"], ln["s"], ln["t"]))
    for who, q in data["vs"].items():
        for k, t in q.items():
            banks.setdefault("vs", []).append((f"vs_{who}_{k}", who, t))
    for who, q in data["barks"].items():
        for k, t in q.items():
            banks.setdefault("barks", []).append((f"b_{who}_{k}", who, t))
    return banks


def style(tts, voices):
    arrs = [tts.voices[v] for v in voices]
    return np.mean(arrs, axis=0).astype(np.float32) if len(arrs) > 1 else arrs[0]


def fx(audio, filt):
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "a.wav"), os.path.join(d, "b.wav")
        sf.write(a, audio, SR)
        args = [FF, "-v", "error", "-y", "-i", a]
        args += ["-filter_complex", filt] if filt.startswith("[") else ["-af", filt]
        subprocess.run(args + ["-ar", str(SR), "-ac", "1", b], check=True)
        out, _ = sf.read(b, dtype="float32")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--voices", required=True)
    args = ap.parse_args()
    tts = Kokoro(args.model, args.voices)
    os.makedirs(os.path.join(ROOT, "voice"), exist_ok=True)
    manifest = {"banks": {}, "clips": {}}
    gap = np.zeros(int(SR * 0.3), dtype=np.float32)
    for bank, lines in load_lines().items():
        parts, pos = [gap], len(gap)
        for cid, who, text in lines:
            voices, speed, filt = CAST[who]
            lang = "en-gb" if voices[0].startswith("b") else "en-us"
            audio, _ = tts.create(text, voice=style(tts, voices), speed=speed, lang=lang)
            audio = fx(audio.astype(np.float32), filt)
            manifest["clips"][cid] = [bank, round(pos / SR, 3), round(len(audio) / SR, 3)]
            parts += [audio, gap]
            pos += len(audio) + len(gap)
            print(f"{cid:14s} {who:9s} {len(audio)/SR:5.2f}s  {text[:60]}")
        wav = os.path.join(tempfile.gettempdir(), f"bank_{bank}.wav")
        sf.write(wav, np.concatenate(parts), SR)
        mp3 = os.path.join(ROOT, "voice", f"{bank}.mp3")
        subprocess.run([FF, "-v", "error", "-y", "-i", wav, "-ac", "1", "-ar", str(SR), "-c:a", "libmp3lame", "-b:a", "56k", mp3], check=True)
        manifest["banks"][bank] = f"voice/{bank}.mp3"
    with open(os.path.join(ROOT, "js", "voice-manifest.js"), "w") as f:
        f.write("window.VOICE = " + json.dumps(manifest, separators=(",", ":")) + ";\n")


if __name__ == "__main__":
    main()
