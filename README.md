# Local Video Studio

A no-subscription local video editor. It runs on your computer, uses no paid
API or account, and lets you edit your own video, image, audio, text, and
sticker clips.

This is a video editor, **not** an AI prompt-to-video generator. It does not
need a video-generation API key.

## Requirements

- Python 3.10 or later
- FFmpeg available on `PATH` for local MP4 export and media metadata
- Windows SAPI voices for offline text-to-speech (Windows only)

## Run on Windows

1. Install the Python packages:

   ```powershell
   python -m pip install -r requirements.txt
   ```

2. Double-click [`run.bat`](./run.bat), or start it from PowerShell:

   ```powershell
   python server.py
   ```

3. Open <http://127.0.0.1:8080/>.

The server binds to `127.0.0.1`, so it is available only on this computer.
Uploaded files, projects, and exports stay in the local `uploads/`, `projects/`,
and `exports/` directories; these directories are excluded from Git.

## Export notes

- Browser timeline export downloads WebM with rendered visuals. It does not
  include timeline audio.
- Local FFmpeg MP4 export supports one uploaded video clip and the first
  uploaded audio clip. It does not render text or sticker overlays.
- Offline text-to-speech uses voices installed with Windows.

No hosted rendering, paid service, or subscription is included.
