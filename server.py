import os
import sys
import json
import uuid
import shutil
import subprocess
import webbrowser
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, send_file

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR
UPLOADS_DIR = BASE_DIR / "uploads"
EXPORTS_DIR = BASE_DIR / "exports"
PROJECTS_DIR = BASE_DIR / "projects"

for d in [UPLOADS_DIR, EXPORTS_DIR, PROJECTS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

app = Flask(__name__, static_folder=str(STATIC_DIR))

# Locate FFmpeg
FFMPEG_BIN = shutil.which("ffmpeg")
FFPROBE_BIN = shutil.which("ffprobe")

if not FFMPEG_BIN:
    # Try finding in WinGet packages
    possible_paths = list(Path(os.environ.get("LOCALAPPDATA", "")).glob("**/ffmpeg.exe"))
    if possible_paths:
        FFMPEG_BIN = str(possible_paths[0])
        probe_path = possible_paths[0].parent / "ffprobe.exe"
        if probe_path.exists():
            FFPROBE_BIN = str(probe_path)

print(f"[Local Video Studio] FFmpeg Path: {FFMPEG_BIN}")
print(f"[Local Video Studio] FFprobe Path: {FFPROBE_BIN}")

# SAPI Voice Init
def get_tts_voices():
    voices = []
    try:
        import win32com.client
        sapi = win32com.client.Dispatch("SAPI.SpVoice")
        sapi_voices = sapi.GetVoices()
        for i in range(sapi_voices.Count):
            v = sapi_voices.Item(i)
            voices.append({
                "id": i,
                "name": v.GetDescription()
            })
    except Exception as e:
        print("[Local Video Studio] SAPI TTS not available:", e)
    return voices

TTS_VOICES = get_tts_voices()


# ---------------------- STATIC ROUTES ---------------------- #
@app.route("/")
def index():
    return send_from_directory(str(STATIC_DIR), "index.html")

@app.route("/styles/<path:filename>")
def serve_styles(filename):
    return send_from_directory(str(STATIC_DIR / "styles"), filename)

@app.route("/scripts/<path:filename>")
def serve_scripts(filename):
    return send_from_directory(str(STATIC_DIR / "scripts"), filename)

@app.route("/assets/<path:filename>")
def serve_assets(filename):
    return send_from_directory(str(STATIC_DIR / "assets"), filename)

@app.route("/uploads/<path:filename>")
def serve_uploads(filename):
    return send_from_directory(str(UPLOADS_DIR), filename)

@app.route("/exports/<path:filename>")
def serve_exports(filename):
    return send_from_directory(str(EXPORTS_DIR), filename)


# ---------------------- API ROUTES ---------------------- #

@app.route("/api/status", methods=["GET"])
def api_status():
    ffmpeg_version = "Unknown"
    if FFMPEG_BIN:
        try:
            res = subprocess.run([FFMPEG_BIN, "-version"], capture_output=True, text=True, timeout=5)
            ffmpeg_version = res.stdout.splitlines()[0] if res.stdout else "Available"
        except Exception as e:
            ffmpeg_version = f"Error: {e}"

    return jsonify({
        "status": "online",
        "ffmpeg": {
            "available": bool(FFMPEG_BIN),
            "path": FFMPEG_BIN,
            "version": ffmpeg_version
        },
        "tts": {
            "available": len(TTS_VOICES) > 0,
            "voices": TTS_VOICES
        },
        "system": {
            "platform": sys.platform,
            "cpu_count": os.cpu_count()
        }
    })


@app.route("/api/upload", methods=["POST"])
def api_upload():
    if "file" not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    ext = Path(file.filename).suffix.lower()
    asset_id = f"asset_{uuid.uuid4().hex[:8]}"
    clean_name = f"{asset_id}{ext}"
    dest_path = UPLOADS_DIR / clean_name
    file.save(str(dest_path))

    # Detect file type
    media_type = "video"
    if ext in [".mp3", ".wav", ".ogg", ".aac", ".m4a", ".flac"]:
        media_type = "audio"
    elif ext in [".png", ".jpg", ".jpeg", ".webp", ".gif"]:
        media_type = "image"

    duration = 5.0
    width = 1280
    height = 720
    thumbnail_url = None

    # Probe metadata with ffprobe
    if FFPROBE_BIN and media_type in ["video", "audio"]:
        try:
            cmd = [
                FFPROBE_BIN, "-v", "error",
                "-show_entries", "format=duration:stream=width,height",
                "-of", "json", str(dest_path)
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            data = json.loads(res.stdout)
            if "format" in data and "duration" in data["format"]:
                duration = float(data["format"]["duration"])
            if "streams" in data:
                for s in data["streams"]:
                    if "width" in s and "height" in s:
                        width = int(s["width"])
                        height = int(s["height"])
                        break
        except Exception as e:
            print("[Local Video Studio] Probe error:", e)

    # Generate thumbnail for video
    if FFMPEG_BIN and media_type == "video":
        thumb_name = f"thumb_{asset_id}.jpg"
        thumb_path = UPLOADS_DIR / thumb_name
        try:
            seek_pos = min(1.0, duration / 2)
            cmd = [
                FFMPEG_BIN, "-y", "-ss", str(seek_pos),
                "-i", str(dest_path), "-vframes", "1",
                "-vf", "scale=320:-1", str(thumb_path)
            ]
            subprocess.run(cmd, capture_output=True, timeout=5)
            if thumb_path.exists():
                thumbnail_url = f"/uploads/{thumb_name}"
        except Exception as e:
            print("[Local Video Studio] Thumbnail generation error:", e)

    return jsonify({
        "success": True,
        "asset": {
            "id": asset_id,
            "name": file.filename,
            "type": media_type,
            "url": f"/uploads/{clean_name}",
            "thumbnailUrl": thumbnail_url,
            "duration": round(duration, 2),
            "width": width,
            "height": height
        }
    })


@app.route("/api/tts", methods=["POST"])
def api_tts():
    """Generate speech with installed Windows SAPI voices."""
    data = request.json or {}
    text = data.get("text", "").strip()
    voice_idx = int(data.get("voice", 0))
    rate = int(data.get("rate", 0)) # -10 to +10

    if not text:
        return jsonify({"error": "Text is required"}), 400

    out_name = f"tts_{uuid.uuid4().hex[:8]}.wav"
    out_path = UPLOADS_DIR / out_name

    try:
        import pythoncom
        pythoncom.CoInitialize()
        try:
            import win32com.client
            sapi = win32com.client.Dispatch("SAPI.SpVoice")
            voices = sapi.GetVoices()
            if 0 <= voice_idx < voices.Count:
                sapi.Voice = voices.Item(voice_idx)

            sapi.Rate = max(-10, min(10, rate))

            stream = win32com.client.Dispatch("SAPI.SpFileStream")
            stream.Open(str(out_path), 3, False)
            sapi.AudioOutputStream = stream
            sapi.Speak(text)
            stream.Close()
        finally:
            pythoncom.CoUninitialize()

        # Probe duration
        duration = 3.0
        if FFPROBE_BIN:
            cmd = [
                FFPROBE_BIN, "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1", str(out_path)
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            if res.stdout.strip():
                duration = float(res.stdout.strip())

        return jsonify({
            "success": True,
            "url": f"/uploads/{out_name}",
            "duration": round(duration, 2),
            "name": f"Offline Voice ({text[:20]}...)"
        })
    except Exception as e:
        print("[Local Video Studio] TTS Error:", e)
        return jsonify({"error": f"TTS generation failed: {e}"}), 500


@app.route("/api/extract-audio", methods=["POST"])
def api_extract_audio():
    """Extracts MP3 audio track from a video"""
    if not FFMPEG_BIN:
        return jsonify({"error": "FFmpeg not available"}), 500

    data = request.json or {}
    video_url = data.get("videoUrl", "")
    if not video_url:
        return jsonify({"error": "videoUrl is required"}), 400

    # Resolve video path
    filename = Path(video_url).name
    input_path = UPLOADS_DIR / filename
    if not input_path.exists():
        return jsonify({"error": "Video file not found"}), 404

    out_name = f"extracted_{uuid.uuid4().hex[:8]}.mp3"
    out_path = UPLOADS_DIR / out_name

    cmd = [
        FFMPEG_BIN, "-y", "-i", str(input_path),
        "-vn", "-acodec", "libmp3lame", "-q:a", "2",
        str(out_path)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if not out_path.exists():
        return jsonify({"error": f"Audio extraction failed: {res.stderr}"}), 500

    # Probe duration
    duration = 5.0
    if FFPROBE_BIN:
        cmd_p = [
            FFPROBE_BIN, "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(out_path)
        ]
        res_p = subprocess.run(cmd_p, capture_output=True, text=True, timeout=5)
        if res_p.stdout.strip():
            duration = float(res_p.stdout.strip())

    return jsonify({
        "success": True,
        "url": f"/uploads/{out_name}",
        "duration": round(duration, 2),
        "name": f"Extracted Audio - {filename}"
    })


@app.route("/api/render", methods=["POST"])
def api_render():
    """Server-side high-definition FFmpeg Video Rendering & Export"""
    if not FFMPEG_BIN:
        return jsonify({"error": "FFmpeg not available on server"}), 500

    data = request.json or {}
    clips = data.get("clips", [])
    total_duration = float(data.get("totalDuration", 5.0))
    aspect_ratio = data.get("aspectRatio", "16:9")
    adjustments = data.get("adjustments", {})

    w, h = 1920, 1080
    if aspect_ratio == "9:16":
        w, h = 1080, 1920
    elif aspect_ratio == "1:1":
        w, h = 1080, 1080
    elif aspect_ratio == "4:5":
        w, h = 1080, 1350

    out_name = f"local_video_export_{uuid.uuid4().hex[:8]}.mp4"
    out_path = EXPORTS_DIR / out_name

    # Filter out clips with valid local files
    valid_video_clips = []
    valid_audio_clips = []

    for c in clips:
        track = c.get("trackType")
        url = c.get("url", "")
        if url.startswith("/uploads/"):
            local_file = UPLOADS_DIR / Path(url).name
            if local_file.exists():
                c_copy = dict(c)
                c_copy["local_file"] = str(local_file)
                if track in ["video", "overlay"]:
                    valid_video_clips.append(c_copy)
                elif track == "audio":
                    valid_audio_clips.append(c_copy)

    # If there are uploaded video clips, stitch or process them with FFmpeg
    if valid_video_clips:
        primary_clip = valid_video_clips[0]
        input_file = primary_clip["local_file"]
        clip_duration = min(total_duration, float(primary_clip.get("duration", total_duration)))

        # Build FFmpeg filterchain
        vf_filters = [f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2"]

        # Color adjustments
        brightness = (float(adjustments.get("brightness", 100)) - 100) / 100.0 * 0.5
        contrast = float(adjustments.get("contrast", 100)) / 100.0
        saturation = float(adjustments.get("saturation", 100)) / 100.0

        eq_filter = f"eq=contrast={contrast}:brightness={brightness}:saturation={saturation}"
        vf_filters.append(eq_filter)

        cmd = [
            FFMPEG_BIN, "-y",
            "-ss", str(primary_clip.get("startTime", 0)),
            "-i", input_file
        ]

        # Add background audio if available
        if valid_audio_clips:
            cmd.extend(["-i", valid_audio_clips[0]["local_file"]])
            cmd.extend([
                "-t", str(clip_duration),
                "-vf", ",".join(vf_filters),
                "-c:v", "libx264", "-preset", "fast", "-crf", "20",
                "-c:a", "aac", "-b:a", "192k",
                "-map", "0:v:0", "-map", "1:a:0?",
                str(out_path)
            ])
        else:
            cmd.extend([
                "-t", str(clip_duration),
                "-vf", ",".join(vf_filters),
                "-c:v", "libx264", "-preset", "fast", "-crf", "20",
                "-c:a", "aac",
                str(out_path)
            ])

        res = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if not out_path.exists():
            print("[Local Video Studio] FFmpeg render stderr:", res.stderr)
            return jsonify({"error": f"FFmpeg render failed: {res.stderr}"}), 500

    else:
        return jsonify({
            "error": "No uploaded video clip is available for FFmpeg export. Use browser export for generated clips, images, text, and overlays."
        }), 400

    if out_path.exists():
        return jsonify({
            "success": True,
            "url": f"/exports/{out_name}",
            "filename": out_name,
            "size": out_path.stat().st_size
        })
    else:
        return jsonify({"error": "Failed to create export video file"}), 500


# ---------------------- PROJECT STORAGE ---------------------- #

@app.route("/api/project/save", methods=["POST"])
def api_project_save():
    data = request.json or {}
    project_id = data.get("id") or f"proj_{uuid.uuid4().hex[:8]}"
    project_name = data.get("name") or "Untitled Project"

    payload = {
        "id": project_id,
        "name": project_name,
        "updatedAt": str(uuid.uuid1()),
        "data": data
    }

    file_path = PROJECTS_DIR / f"{project_id}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    return jsonify({"success": True, "projectId": project_id})


@app.route("/api/project/list", methods=["GET"])
def api_project_list():
    projects = []
    for p in PROJECTS_DIR.glob("*.json"):
        try:
            with open(p, "r", encoding="utf-8") as f:
                d = json.load(f)
                projects.append({
                    "id": d.get("id"),
                    "name": d.get("name"),
                    "updatedAt": d.get("updatedAt")
                })
        except Exception:
            pass
    return jsonify({"projects": projects})


@app.route("/api/project/load/<project_id>", methods=["GET"])
def api_project_load(project_id):
    file_path = PROJECTS_DIR / f"{project_id}.json"
    if not file_path.exists():
        return jsonify({"error": "Project not found"}), 404
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return jsonify({"success": True, "project": data})


if __name__ == "__main__":
    port = 8080
    url = f"http://127.0.0.1:{port}/"
    print("=" * 60)
    print(f" Local Video Studio running at: {url}")
    print(f" FFmpeg Rendering: {'ENABLED' if FFMPEG_BIN else 'DISABLED'}")
    print(f" Windows offline speech: {'ENABLED' if TTS_VOICES else 'DISABLED'}")
    print("=" * 60)

    # Launch browser automatically
    webbrowser.open(url)
    app.run(host="127.0.0.1", port=port, debug=False)
