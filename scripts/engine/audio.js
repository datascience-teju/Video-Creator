/**
 * CapCut Studio - Web Audio Mixing & Voiceover Engine
 */

export class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.mediaElements = new Map(); // clipId -> HTMLAudioElement
    this.recorder = null;
    this.recordedChunks = [];
  }

  init() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  getAudioElement(clip) {
    if (!this.mediaElements.has(clip.id)) {
      const audio = new Audio(clip.url);
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      this.mediaElements.set(clip.id, audio);
    }
    return this.mediaElements.get(clip.id);
  }

  syncAudio(clips, currentTime, isPlaying, masterVolume = 1.0) {
    this.init();

    clips.forEach(clip => {
      if (clip.trackType !== 'audio' && clip.trackType !== 'video') return;
      if (!clip.url) return;

      const audio = this.getAudioElement(clip);
      const clipStart = clip.startTime;
      const clipEnd = clip.startTime + clip.duration;
      const inClipTime = (currentTime - clipStart) * (clip.speed || 1);

      const isActive = currentTime >= clipStart && currentTime < clipEnd;

      if (isActive && isPlaying) {
        audio.volume = Math.max(0, Math.min(1, (clip.volume ?? 1) * masterVolume));
        audio.playbackRate = clip.speed || 1;

        // Sync seek if drifting
        if (Math.abs(audio.currentTime - inClipTime) > 0.15) {
          audio.currentTime = inClipTime;
        }

        if (audio.paused) {
          audio.play().catch(() => {});
        }
      } else {
        if (!audio.paused) {
          audio.pause();
        }
      }
    });
  }

  pauseAll() {
    this.mediaElements.forEach(audio => {
      if (!audio.paused) {
        audio.pause();
      }
    });
  }

  seekAll(clips, currentTime) {
    clips.forEach(clip => {
      if (!clip.url) return;
      const audio = this.getAudioElement(clip);
      const clipStart = clip.startTime;
      const inClipTime = (currentTime - clipStart) * (clip.speed || 1);

      if (currentTime >= clipStart && currentTime < clipStart + clip.duration) {
        audio.currentTime = Math.max(0, inClipTime);
      } else {
        audio.pause();
      }
    });
  }

  // Voiceover Recording with Microphone
  async startVoiceRecording() {
    this.init();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.recordedChunks = [];
    this.recorder = new MediaRecorder(stream);

    this.recorder.ondataavailable = e => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };

    this.recorder.start();
    return true;
  }

  stopVoiceRecording() {
    return new Promise(resolve => {
      if (!this.recorder || this.recorder.state === 'inactive') {
        resolve(null);
        return;
      }
      this.recorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        resolve({ blob, url });
      };
      this.recorder.stop();
    });
  }
}
