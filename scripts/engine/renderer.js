/**
 * CapCut Studio - Canvas Multi-Track Video Compositor
 */

import { applyVideoEffects } from '../tools/filters.js';
import { renderTextClip } from '../tools/text.js';
import { renderStickerClip } from '../tools/stickers.js';

export class VideoRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.aspectRatio = '16:9';
    this.width = 1280;
    this.height = 720;
    this.videoElements = new Map(); // clipId -> HTMLVideoElement
    this.imageElements = new Map(); // clipId -> HTMLImageElement
    this.showSafeZones = false;
    this.updateDimensions();
  }

  setAspectRatio(ratio) {
    this.aspectRatio = ratio;
    this.updateDimensions();
  }

  updateDimensions() {
    switch (this.aspectRatio) {
      case '9:16': // TikTok, Shorts, Reels
        this.width = 720;
        this.height = 1280;
        break;
      case '1:1': // Instagram Square
        this.width = 1080;
        this.height = 1080;
        break;
      case '4:5': // Social Portrait
        this.width = 864;
        this.height = 1080;
        break;
      case '21:9': // Ultrawide Cinematic
        this.width = 1680;
        this.height = 720;
        break;
      case '16:9': // YouTube, Standard
      default:
        this.width = 1280;
        this.height = 720;
        break;
    }
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  getVideoElement(clip) {
    if (!this.videoElements.has(clip.id)) {
      const video = document.createElement('video');
      video.src = clip.url;
      video.crossOrigin = 'anonymous';
      video.playsInline = true;
      video.muted = true; // Audio is handled by AudioEngine
      video.preload = 'auto';
      this.videoElements.set(clip.id, video);
    }
    return this.videoElements.get(clip.id);
  }

  getImageElement(clip) {
    if (!this.imageElements.has(clip.id)) {
      const img = new Image();
      img.src = clip.url;
      img.crossOrigin = 'anonymous';
      this.imageElements.set(clip.id, img);
    }
    return this.imageElements.get(clip.id);
  }

  syncVideoElements(clips, currentTime, isPlaying) {
    clips.forEach(clip => {
      if (clip.trackType !== 'video' && clip.trackType !== 'overlay') return;
      if (!clip.url || clip.mediaType === 'image') return;

      const video = this.getVideoElement(clip);
      const clipStart = clip.startTime;
      const clipEnd = clip.startTime + clip.duration;
      const inClipTime = (currentTime - clipStart) * (clip.speed || 1);

      const isActive = currentTime >= clipStart && currentTime < clipEnd;

      if (isActive) {
        video.playbackRate = clip.speed || 1;
        if (Math.abs(video.currentTime - inClipTime) > 0.1) {
          video.currentTime = inClipTime;
        }
        if (isPlaying && video.paused) {
          video.play().catch(() => {});
        } else if (!isPlaying && !video.paused) {
          video.pause();
        }
      } else {
        if (!video.paused) {
          video.pause();
        }
      }
    });
  }

  renderFrame(timelineState) {
    const { clips, currentTime, globalAdjustments, globalEffect } = timelineState;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // 1. Clear background
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    // Apply global video filter & adjustments
    const postFilterCallback = applyVideoEffects(
      ctx,
      w,
      h,
      globalAdjustments || {},
      globalEffect || 'none',
      currentTime
    );

    // 2. Render Layer 1: Base Video Track clips
    const activeVideoClips = clips.filter(
      c => (c.trackType === 'video' || c.trackType === 'overlay') &&
           currentTime >= c.startTime && currentTime < (c.startTime + c.duration)
    );

    activeVideoClips.forEach(clip => {
      this.drawVisualClip(ctx, clip, w, h);
    });

    // Run post-effect overlays (Vignette, CRT scanlines, glitch)
    postFilterCallback();

    // 3. Render Layer 2: Text Track clips
    const activeTextClips = clips.filter(
      c => c.trackType === 'text' &&
           currentTime >= c.startTime && currentTime < (c.startTime + c.duration)
    );

    activeTextClips.forEach(clip => {
      renderTextClip(ctx, clip, w, h, currentTime);
    });

    // 4. Render Layer 3: Stickers & Badges
    const activeStickerClips = clips.filter(
      c => c.trackType === 'sticker' &&
           currentTime >= c.startTime && currentTime < (c.startTime + c.duration)
    );

    activeStickerClips.forEach(clip => {
      renderStickerClip(ctx, clip, w, h, currentTime);
    });

    // 5. Safe Zones Guide Overlay (if enabled)
    if (this.showSafeZones) {
      this.drawSafeZones(ctx, w, h);
    }

    ctx.restore();
  }

  drawVisualClip(ctx, clip, canvasWidth, canvasHeight) {
    ctx.save();

    const scale = clip.scale || 1;
    const rotation = clip.rotation || 0;
    const posX = (clip.x !== undefined ? clip.x : 0.5) * canvasWidth;
    const posY = (clip.y !== undefined ? clip.y : 0.5) * canvasHeight;
    const opacity = clip.opacity !== undefined ? clip.opacity : 1;

    ctx.globalAlpha = opacity;
    ctx.translate(posX, posY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);

    if (clip.mediaType === 'image') {
      const img = this.getImageElement(clip);
      if (img.complete && img.naturalWidth > 0) {
        // Fit within canvas while preserving aspect ratio
        const imgRatio = img.naturalWidth / img.naturalHeight;
        let dw = canvasWidth;
        let dh = canvasWidth / imgRatio;
        if (dh < canvasHeight) {
          dh = canvasHeight;
          dw = canvasHeight * imgRatio;
        }
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      }
    } else {
      const video = this.getVideoElement(clip);
      if (video.readyState >= 2) {
        const vidRatio = (video.videoWidth || 16) / (video.videoHeight || 9);
        let dw = canvasWidth;
        let dh = canvasWidth / vidRatio;
        if (dh < canvasHeight) {
          dh = canvasHeight;
          dw = canvasHeight * vidRatio;
        }
        ctx.drawImage(video, -dw / 2, -dh / 2, dw, dh);
      }
    }

    ctx.restore();
  }

  drawSafeZones(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);

    // Center crosshair
    ctx.beginPath();
    ctx.moveTo(w / 2 - 20, h / 2);
    ctx.lineTo(w / 2 + 20, h / 2);
    ctx.moveTo(w / 2, h / 2 - 20);
    ctx.lineTo(w / 2, h / 2 + 20);
    ctx.stroke();

    // 9:16 safe zone bounds (TikTok / Reels UI margins)
    const marginX = w * 0.08;
    const marginTop = h * 0.12;
    const marginBottom = h * 0.18;
    ctx.strokeRect(marginX, marginTop, w - marginX * 2, h - marginTop - marginBottom);

    ctx.restore();
  }
}
