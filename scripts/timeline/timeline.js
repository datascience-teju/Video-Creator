/**
 * CapCut Studio - Interactive Multi-Track Timeline
 */

export class Timeline {
  constructor(container, options = {}) {
    this.container = container;
    this.rulerCanvas = container.querySelector('#rulerCanvas');
    this.rulerCtx = this.rulerCanvas ? this.rulerCanvas.getContext('2d') : null;
    this.lanesArea = container.querySelector('#trackLanesArea');
    this.playhead = container.querySelector('#timelinePlayhead');

    this.pxPerSec = 80; // Zoom level (pixels per second)
    this.currentTime = 0;
    this.totalDuration = 10;
    this.selectedClip = null;
    this.isDraggingPlayhead = false;
    this.draggedClipState = null;
    this.trimmingState = null;
    this.snapEnabled = true;

    this.tracks = [
      { id: 'track-text', name: 'Text', type: 'text', icon: 'T' },
      { id: 'track-sticker', name: 'Stickers', type: 'sticker', icon: '⭐' },
      { id: 'track-overlay', name: 'Overlay', type: 'overlay', icon: '🎞️' },
      { id: 'track-video', name: 'Main Video', type: 'video', icon: '🎬' },
      { id: 'track-audio', name: 'BGM / Audio', type: 'audio', icon: '🎵' }
    ];

    this.clips = [];
    this.onTimeChange = options.onTimeChange || (() => {});
    this.onClipSelect = options.onClipSelect || (() => {});
    this.onTimelineChange = options.onTimelineChange || (() => {});

    this.initEvents();
  }

  setClips(clips) {
    this.clips = clips;
    this.updateTotalDuration();
    this.render();
  }

  addClip(clip) {
    if (!clip.id) clip.id = 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    if (clip.startTime === undefined) clip.startTime = this.currentTime;
    if (!clip.duration) clip.duration = 3;

    this.clips.push(clip);
    this.selectClip(clip);
    this.updateTotalDuration();
    this.render();
    this.onTimelineChange();
  }

  updateTotalDuration() {
    let max = 10;
    this.clips.forEach(c => {
      const end = c.startTime + c.duration;
      if (end > max) max = end;
    });
    this.totalDuration = Math.max(10, Math.ceil(max + 2));
    this.updateLanesWidth();
    this.renderRuler();
  }

  updateLanesWidth() {
    if (this.lanesArea) {
      const neededWidth = Math.max(1200, this.totalDuration * this.pxPerSec + 200);
      this.lanesArea.style.width = neededWidth + 'px';
      if (this.rulerCanvas) {
        this.rulerCanvas.width = neededWidth;
      }
    }
  }

  seek(time, fireEvent = true) {
    this.currentTime = Math.max(0, Math.min(this.totalDuration, time));
    const leftPx = this.currentTime * this.pxPerSec;
    if (this.playhead) {
      this.playhead.style.left = leftPx + 'px';
    }
    if (fireEvent) {
      this.onTimeChange(this.currentTime);
    }
  }

  selectClip(clip) {
    this.selectedClip = clip;
    const allClipEls = this.lanesArea.querySelectorAll('.timeline-clip');
    allClipEls.forEach(el => {
      if (el.dataset.clipId === (clip ? clip.id : null)) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
    this.onClipSelect(this.selectedClip);
  }

  splitSelectedClip() {
    if (!this.selectedClip) return;
    const clip = this.selectedClip;
    const splitPoint = this.currentTime;

    if (splitPoint <= clip.startTime + 0.1 || splitPoint >= clip.startTime + clip.duration - 0.1) {
      return; // Too close to boundaries
    }

    const firstDuration = splitPoint - clip.startTime;
    const secondDuration = clip.duration - firstDuration;

    // First part
    clip.duration = firstDuration;

    // Second part clone
    const secondClip = {
      ...clip,
      id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      startTime: splitPoint,
      duration: secondDuration,
      name: (clip.name || 'Clip') + ' (Part 2)'
    };

    this.clips.push(secondClip);
    this.selectClip(secondClip);
    this.render();
    this.onTimelineChange();
  }

  deleteSelectedClip() {
    if (!this.selectedClip) return;
    const index = this.clips.findIndex(c => c.id === this.selectedClip.id);
    if (index !== -1) {
      this.clips.splice(index, 1);
      this.selectClip(null);
      this.updateTotalDuration();
      this.render();
      this.onTimelineChange();
    }
  }

  duplicateSelectedClip() {
    if (!this.selectedClip) return;
    const clone = {
      ...this.selectedClip,
      id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      startTime: this.selectedClip.startTime + this.selectedClip.duration,
      name: (this.selectedClip.name || 'Clip') + ' (Copy)'
    };
    this.clips.push(clone);
    this.selectClip(clone);
    this.updateTotalDuration();
    this.render();
    this.onTimelineChange();
  }

  zoom(delta) {
    this.pxPerSec = Math.max(30, Math.min(250, this.pxPerSec + delta));
    this.updateLanesWidth();
    this.seek(this.currentTime, false);
    this.render();
  }

  render() {
    this.renderRuler();
    this.renderLanes();
  }

  renderRuler() {
    if (!this.rulerCtx || !this.rulerCanvas) return;
    const ctx = this.rulerCtx;
    const w = this.rulerCanvas.width;
    const h = this.rulerCanvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1e222d';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#3d445a';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    const stepSec = this.pxPerSec < 60 ? 2 : 1;
    const totalSecs = Math.ceil(w / this.pxPerSec);

    for (let s = 0; s <= totalSecs; s++) {
      const x = s * this.pxPerSec;

      if (s % stepSec === 0) {
        // Major second tick
        ctx.beginPath();
        ctx.moveTo(x, h - 14);
        ctx.lineTo(x, h);
        ctx.stroke();

        const mins = Math.floor(s / 60);
        const secs = s % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        ctx.fillText(timeStr, x, 12);
      } else {
        // Minor tick
        ctx.beginPath();
        ctx.moveTo(x, h - 6);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Half second mark
      const halfX = x + this.pxPerSec / 2;
      ctx.beginPath();
      ctx.moveTo(halfX, h - 4);
      ctx.lineTo(halfX, h);
      ctx.stroke();
    }
  }

  renderLanes() {
    if (!this.lanesArea) return;
    this.lanesArea.innerHTML = '';

    this.tracks.forEach(track => {
      const lane = document.createElement('div');
      lane.className = `track-lane lane-${track.type}`;
      lane.dataset.trackType = track.type;

      // Filter clips belonging to this track
      const trackClips = this.clips.filter(c => c.trackType === track.type);

      trackClips.forEach(clip => {
        const clipEl = document.createElement('div');
        clipEl.className = `timeline-clip clip-${clip.trackType}`;
        if (this.selectedClip && this.selectedClip.id === clip.id) {
          clipEl.classList.add('selected');
        }
        clipEl.dataset.clipId = clip.id;

        const left = clip.startTime * this.pxPerSec;
        const width = Math.max(20, clip.duration * this.pxPerSec);

        clipEl.style.left = left + 'px';
        clipEl.style.width = width + 'px';

        // Content label
        const label = document.createElement('span');
        label.className = 'clip-label';
        label.textContent = clip.name || clip.text || clip.sticker || 'Clip';
        clipEl.appendChild(label);

        // Trim handles
        const leftHandle = document.createElement('div');
        leftHandle.className = 'trim-handle start';
        const rightHandle = document.createElement('div');
        rightHandle.className = 'trim-handle end';

        clipEl.appendChild(leftHandle);
        clipEl.appendChild(rightHandle);

        lane.appendChild(clipEl);
      });

      this.lanesArea.appendChild(lane);
    });
  }

  initEvents() {
    // 1. Ruler click / scrub
    if (this.rulerCanvas) {
      this.rulerCanvas.addEventListener('mousedown', e => {
        const rect = this.rulerCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        this.seek(clickX / this.pxPerSec);
        this.isDraggingPlayhead = true;
      });
    }

    // 2. Playhead needle drag
    const needleCap = this.container.querySelector('#playheadNeedleCap');
    if (needleCap) {
      needleCap.addEventListener('mousedown', e => {
        e.stopPropagation();
        this.isDraggingPlayhead = true;
      });
    }

    // 3. Global mouse move / mouse up for scrubbing, clip moving, and trimming
    window.addEventListener('mousemove', e => {
      if (this.isDraggingPlayhead && this.rulerCanvas) {
        const rect = this.rulerCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        this.seek(Math.max(0, clickX / this.pxPerSec));
      }

      // Dragging clip
      if (this.draggedClipState) {
        const { clip, startMouseX, startClipTime } = this.draggedClipState;
        const deltaSec = (e.clientX - startMouseX) / this.pxPerSec;
        let newStartTime = Math.max(0, startClipTime + deltaSec);

        // Snapping to playhead
        if (this.snapEnabled && Math.abs(newStartTime - this.currentTime) < 0.2) {
          newStartTime = this.currentTime;
        }

        clip.startTime = newStartTime;
        this.updateTotalDuration();
        this.renderLanes();
        this.onTimelineChange();
      }

      // Trimming clip
      if (this.trimmingState) {
        const { clip, handleType, startMouseX, startStartTime, startDuration } = this.trimmingState;
        const deltaSec = (e.clientX - startMouseX) / this.pxPerSec;

        if (handleType === 'start') {
          const maxShift = startDuration - 0.2;
          const shift = Math.min(maxShift, deltaSec);
          clip.startTime = Math.max(0, startStartTime + shift);
          clip.duration = startDuration - shift;
        } else {
          // 'end' handle
          clip.duration = Math.max(0.2, startDuration + deltaSec);
        }

        this.updateTotalDuration();
        this.renderLanes();
        this.onTimelineChange();
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingPlayhead = false;
      this.draggedClipState = null;
      this.trimmingState = null;
    });

    // 4. Clip interaction delegation on lanes area
    if (this.lanesArea) {
      this.lanesArea.addEventListener('mousedown', e => {
        const clipEl = e.target.closest('.timeline-clip');
        if (!clipEl) {
          this.selectClip(null);
          return;
        }

        const clipId = clipEl.dataset.clipId;
        const clip = this.clips.find(c => c.id === clipId);
        if (!clip) return;

        this.selectClip(clip);

        // Check if trim handle clicked
        if (e.target.classList.contains('trim-handle')) {
          e.stopPropagation();
          const handleType = e.target.classList.contains('start') ? 'start' : 'end';
          this.trimmingState = {
            clip,
            handleType,
            startMouseX: e.clientX,
            startStartTime: clip.startTime,
            startDuration: clip.duration
          };
          return;
        }

        // Start clip movement drag
        this.draggedClipState = {
          clip,
          startMouseX: e.clientX,
          startClipTime: clip.startTime
        };
      });
    }
  }
}
