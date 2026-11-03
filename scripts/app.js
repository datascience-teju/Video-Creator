/**
 * CapCut Studio - Main Application Controller (Integrated with Python & FFmpeg Backend)
 */

import { VideoRenderer } from './engine/renderer.js';
import { AudioEngine } from './engine/audio.js';
import { VideoExporter } from './engine/exporter.js';
import { Timeline } from './timeline/timeline.js';
import { FILTER_PRESETS, SPECIAL_EFFECTS } from './tools/filters.js';
import { TEXT_PRESETS } from './tools/text.js';
import { STICKER_PACKS } from './tools/stickers.js';
import { generateSampleClips } from './tools/sampleMedia.js';

class CapCutApp {
  constructor() {
    this.canvas = document.getElementById('previewCanvas');
    this.renderer = new VideoRenderer(this.canvas);
    this.audio = new AudioEngine();
    this.exporter = new VideoExporter(this.renderer, this.audio);

    this.timelineContainer = document.getElementById('timelineContainer');
    this.timeline = new Timeline(this.timelineContainer, {
      onTimeChange: (time) => this.onTimeUpdate(time),
      onClipSelect: (clip) => this.onClipSelect(clip),
      onTimelineChange: () => this.renderCurrentFrame()
    });

    this.isPlaying = false;
    this.playAnimationId = null;
    this.lastFrameTimestamp = 0;
    this.backendOnline = false;

    this.state = {
      projectId: 'proj_' + Date.now().toString(36),
      projectTitle: 'My Viral Edit',
      globalFilter: 'normal',
      globalEffect: 'none',
      adjustments: {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        hue: 0,
        blur: 0
      },
      uploadedAssets: []
    };

    this.init();
  }

  async init() {
    this.setupSidebarTabs();
    this.setupTransportControls();
    this.setupHeaderControls();
    this.setupInspectorControls();
    this.setupDropzone();
    this.setupKeyboardShortcuts();
    this.populateSidebarContent();
    this.setupBackendFeatures();

    // Check backend status
    await this.checkBackendStatus();

    // Load initial sample clips
    try {
      const samples = await generateSampleClips();
      this.state.uploadedAssets.push(...samples);
      this.renderAssetLibrary();

      const sampleVideo = samples.find(s => s.type === 'video');
      const sampleAudio = samples.find(s => s.type === 'audio');

      const initialClips = [];
      if (sampleVideo) {
        initialClips.push({
          id: 'initial_video_1',
          trackType: 'video',
          name: sampleVideo.name,
          url: sampleVideo.url,
          startTime: 0,
          duration: sampleVideo.duration,
          scale: 1,
          rotation: 0,
          opacity: 1,
          speed: 1,
          volume: 1
        });
      }

      if (sampleAudio) {
        initialClips.push({
          id: 'initial_audio_1',
          trackType: 'audio',
          name: sampleAudio.name,
          url: sampleAudio.url,
          startTime: 0,
          duration: sampleAudio.duration,
          volume: 0.8,
          speed: 1
        });
      }

      initialClips.push({
        id: 'initial_text_1',
        trackType: 'text',
        text: 'LOCAL VIDEO STUDIO',
        font: 'Impact, sans-serif',
        size: 54,
        fill: '#00F2FE',
        stroke: '#000000',
        strokeWidth: 6,
        background: 'transparent',
        animation: 'pop',
        shadow: true,
        startTime: 0.5,
        duration: 4,
        x: 0.5,
        y: 0.8
      });

      this.timeline.setClips(initialClips);
      this.renderCurrentFrame();
    } catch (err) {
      console.warn('Sample clips initialization:', err);
    }
  }

  /* ------------------- BACKEND INTEGRATION ------------------- */
  async checkBackendStatus() {
    const badgeText = document.getElementById('backendStatusText');
    const voiceSelect = document.getElementById('ttsVoiceSelect');

    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        this.backendOnline = true;
        if (badgeText) {
          badgeText.textContent = `Backend: Online (${data.ffmpeg.available ? 'FFmpeg' : 'No FFmpeg'} & ${data.tts.available ? 'Offline speech' : 'No speech'})`;
        }

        // Populate TTS Voices
        if (voiceSelect && data.tts && data.tts.voices) {
          voiceSelect.innerHTML = '';
          data.tts.voices.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.name;
            voiceSelect.appendChild(opt);
          });
        }
        return;
      }
    } catch (e) {
      console.warn('Backend not responding yet:', e);
    }

    this.backendOnline = false;
    if (badgeText) {
      badgeText.textContent = 'Backend: Standalone Mode';
    }
  }

  setupBackendFeatures() {
    // 1. Offline Text-To-Speech Voiceover Generator
    const btnTTS = document.getElementById('btnGenerateTTS');
    if (btnTTS) {
      btnTTS.addEventListener('click', async () => {
        const textInput = document.getElementById('ttsTextInput');
        const text = textInput ? textInput.value.trim() : '';
        if (!text) {
          alert('Please enter text for the voiceover.');
          return;
        }

        btnTTS.disabled = true;
        btnTTS.textContent = 'Generating Voice...';

        try {
          const voiceSelect = document.getElementById('ttsVoiceSelect');
          const rateSlider = document.getElementById('ttsRateSlider');

          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: text,
              voice: voiceSelect ? parseInt(voiceSelect.value) : 0,
              rate: rateSlider ? parseInt(rateSlider.value) : 0
            })
          });

          const data = await res.json();
          if (data.success && data.url) {
            // Add to timeline
            this.timeline.addClip({
              trackType: 'audio',
              name: data.name || 'Offline Voiceover',
              url: data.url,
              startTime: this.timeline.currentTime,
              duration: data.duration || 3,
              volume: 1
            });
            textInput.value = '';
          } else {
            alert('TTS error: ' + (data.error || 'Failed'));
          }
        } catch (err) {
          console.error('TTS request error:', err);
          alert('Could not connect to backend TTS service.');
        } finally {
          btnTTS.disabled = false;
          btnTTS.textContent = 'Generate Voiceover';
        }
      });
    }

    // 2. Audio Extraction from Selected Video
    const btnExtractAudio = document.getElementById('btnExtractAudio');
    if (btnExtractAudio) {
      btnExtractAudio.addEventListener('click', async () => {
        const clip = this.timeline.selectedClip;
        if (!clip || (clip.trackType !== 'video' && clip.trackType !== 'overlay')) {
          alert('Please select a video clip to separate audio.');
          return;
        }

        btnExtractAudio.disabled = true;
        btnExtractAudio.textContent = 'Extracting Audio...';

        try {
          const res = await fetch('/api/extract-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrl: clip.url })
          });
          const data = await res.json();

          if (data.success && data.url) {
            // Add extracted audio aligned with the video clip
            this.timeline.addClip({
              trackType: 'audio',
              name: data.name,
              url: data.url,
              startTime: clip.startTime,
              duration: clip.duration,
              volume: 1
            });
          } else {
            // Fallback: use video URL as audio source directly
            this.timeline.addClip({
              trackType: 'audio',
              name: `Audio from ${clip.name || 'Video'}`,
              url: clip.url,
              startTime: clip.startTime,
              duration: clip.duration,
              volume: 1
            });
          }
        } catch (err) {
          // Client-side fallback
          this.timeline.addClip({
            trackType: 'audio',
            name: `Audio (${clip.name || 'Video'})`,
            url: clip.url,
            startTime: clip.startTime,
            duration: clip.duration,
            volume: 1
          });
        } finally {
          btnExtractAudio.disabled = false;
          btnExtractAudio.textContent = 'Separate Audio into Track';
        }
      });
    }

    // 3. Project Save & Load
    const btnSave = document.getElementById('btnSaveProject');
    if (btnSave) {
      btnSave.addEventListener('click', () => this.saveProject());
    }

    const btnLoad = document.getElementById('btnLoadProject');
    if (btnLoad) {
      btnLoad.addEventListener('click', () => this.openProjectModal());
    }

    const btnCancelProjectModal = document.getElementById('btnCancelProjectModal');
    if (btnCancelProjectModal) {
      btnCancelProjectModal.addEventListener('click', () => {
        document.getElementById('projectModalOverlay').classList.remove('active');
      });
    }
  }

  async saveProject() {
    const payload = {
      id: this.state.projectId,
      name: this.state.projectTitle,
      clips: this.timeline.clips,
      totalDuration: this.timeline.totalDuration,
      adjustments: this.state.adjustments,
      globalFilter: this.state.globalFilter,
      globalEffect: this.state.globalEffect
    };

    try {
      const res = await fetch('/api/project/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('Project saved successfully to backend!');
      }
    } catch (e) {
      // Local storage fallback
      localStorage.setItem('capcut_project_' + this.state.projectId, JSON.stringify(payload));
      alert('Project saved locally in browser storage!');
    }
  }

  async openProjectModal() {
    const modal = document.getElementById('projectModalOverlay');
    const list = document.getElementById('projectListContainer');
    if (!modal || !list) return;

    modal.classList.add('active');
    list.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; text-align: center;">Fetching projects...</div>';

    try {
      const res = await fetch('/api/project/list');
      const data = await res.json();
      list.innerHTML = '';

      if (data.projects && data.projects.length > 0) {
        data.projects.forEach(p => {
          const item = document.createElement('div');
          item.style.cssText = 'padding: 8px 12px; background: var(--bg-card); border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;';
          item.innerHTML = `
            <span style="font-size: 13px; font-weight: 600; color: #fff;">${p.name || p.id}</span>
            <button class="header-btn" style="padding: 4px 8px; font-size: 11px;">Open</button>
          `;
          item.addEventListener('click', () => this.loadProject(p.id));
          list.appendChild(item);
        });
      } else {
        list.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; text-align: center;">No saved projects found on server.</div>';
      }
    } catch (e) {
      list.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; text-align: center;">Could not load projects from server.</div>';
    }
  }

  async loadProject(projectId) {
    try {
      const res = await fetch(`/api/project/load/${projectId}`);
      const data = await res.json();
      if (data.success && data.project && data.project.data) {
        const p = data.project.data;
        this.state.projectId = p.id;
        this.state.projectTitle = p.name;
        document.getElementById('projectTitleInput').value = p.name;
        this.state.adjustments = p.adjustments || this.state.adjustments;
        this.state.globalFilter = p.globalFilter || 'normal';
        this.state.globalEffect = p.globalEffect || 'none';

        if (p.clips) {
          this.timeline.setClips(p.clips);
        }
        document.getElementById('projectModalOverlay').classList.remove('active');
        this.renderCurrentFrame();
      }
    } catch (e) {
      alert('Error loading project: ' + e);
    }
  }

  /* ------------------- PLAYBACK LOOP ------------------- */
  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    if (this.timeline.currentTime >= this.timeline.totalDuration) {
      this.timeline.seek(0);
    }

    this.lastFrameTimestamp = performance.now();
    this.audio.syncAudio(this.timeline.clips, this.timeline.currentTime, true);

    const playBtn = document.getElementById('btnPlay');
    if (playBtn) {
      playBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      `;
    }

    const loop = (timestamp) => {
      if (!this.isPlaying) return;

      const dt = (timestamp - this.lastFrameTimestamp) / 1000;
      this.lastFrameTimestamp = timestamp;

      const newTime = this.timeline.currentTime + dt;

      if (newTime >= this.timeline.totalDuration) {
        this.timeline.seek(this.timeline.totalDuration);
        this.pause();
        return;
      }

      this.timeline.seek(newTime);
      this.renderCurrentFrame();
      this.audio.syncAudio(this.timeline.clips, this.timeline.currentTime, true);

      this.playAnimationId = requestAnimationFrame(loop);
    };

    this.playAnimationId = requestAnimationFrame(loop);
  }

  pause() {
    this.isPlaying = false;
    if (this.playAnimationId) {
      cancelAnimationFrame(this.playAnimationId);
    }
    this.audio.pauseAll();

    const playBtn = document.getElementById('btnPlay');
    if (playBtn) {
      playBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      `;
    }
    this.renderCurrentFrame();
  }

  onTimeUpdate(time) {
    this.updateTimecodeDisplay(time);
    this.renderCurrentFrame();
    this.audio.seekAll(this.timeline.clips, time);
  }

  renderCurrentFrame() {
    this.renderer.syncVideoElements(this.timeline.clips, this.timeline.currentTime, this.isPlaying);
    this.renderer.renderFrame({
      clips: this.timeline.clips,
      currentTime: this.timeline.currentTime,
      isPlaying: this.isPlaying,
      globalAdjustments: {
        filter: this.state.globalFilter,
        ...this.state.adjustments
      },
      globalEffect: this.state.globalEffect
    });
  }

  updateTimecodeDisplay(seconds) {
    const format = (sec) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      const f = Math.floor((sec % 1) * 30);
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${f.toString().padStart(2, '0')}`;
    };

    const curEl = document.getElementById('timecodeCurrent');
    const totEl = document.getElementById('timecodeTotal');
    if (curEl) curEl.textContent = format(seconds);
    if (totEl) totEl.textContent = format(this.timeline.totalDuration);
  }

  /* ------------------- SIDEBAR TABS & CONTENT ------------------- */
  setupSidebarTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    const panes = document.querySelectorAll('.tab-pane');
    const titleEl = document.getElementById('sidebarTitle');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const targetId = tab.dataset.target;
        const targetPane = document.getElementById(targetId);
        if (targetPane) targetPane.classList.add('active');

        if (titleEl) {
          titleEl.textContent = tab.querySelector('span').textContent;
        }
      });
    });
  }

  populateSidebarContent() {
    // 1. Text Presets
    const textPresetsGrid = document.getElementById('textPresetsGrid');
    if (textPresetsGrid) {
      textPresetsGrid.innerHTML = '';
      TEXT_PRESETS.forEach(preset => {
        const btn = document.createElement('div');
        btn.className = 'preset-btn';
        btn.innerHTML = `
          <div class="preset-preview-box" style="font-family: ${preset.style.font}; font-size: 16px; color: ${preset.style.fill}; background: #13151b;">T</div>
          <span class="preset-name">${preset.name}</span>
        `;
        btn.addEventListener('click', () => {
          this.timeline.addClip({
            trackType: 'text',
            name: preset.name,
            ...preset.style,
            startTime: this.timeline.currentTime,
            duration: 3,
            x: 0.5,
            y: 0.7
          });
        });
        textPresetsGrid.appendChild(btn);
      });
    }

    // 2. Stickers & Badges
    const stickersContainer = document.getElementById('stickersGrid');
    if (stickersContainer) {
      stickersContainer.innerHTML = '';
      STICKER_PACKS.forEach(pack => {
        const packTitle = document.createElement('div');
        packTitle.className = 'section-title';
        packTitle.textContent = pack.category;
        stickersContainer.appendChild(packTitle);

        const grid = document.createElement('div');
        grid.className = 'presets-grid';
        grid.style.gridTemplateColumns = pack.category.includes('Emoji') ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)';

        pack.stickers.forEach(s => {
          const btn = document.createElement('div');
          btn.className = 'preset-btn';
          btn.style.padding = '8px 4px';
          btn.innerHTML = `<span style="font-size: ${pack.category.includes('Emoji') ? '24px' : '11px'}; font-weight: 700;">${s}</span>`;
          btn.addEventListener('click', () => {
            this.timeline.addClip({
              trackType: 'sticker',
              name: s,
              sticker: s,
              isBadge: !pack.category.includes('Emoji'),
              startTime: this.timeline.currentTime,
              duration: 3,
              x: 0.5,
              y: 0.4,
              scale: 1,
              rotation: 0
            });
          });
          grid.appendChild(btn);
        });

        stickersContainer.appendChild(grid);
      });
    }

    // 3. Filters
    const filtersGrid = document.getElementById('filtersGrid');
    if (filtersGrid) {
      filtersGrid.innerHTML = '';
      FILTER_PRESETS.forEach(f => {
        const btn = document.createElement('div');
        btn.className = `preset-btn ${this.state.globalFilter === f.id ? 'active' : ''}`;
        btn.innerHTML = `
          <div class="preset-preview-box">${f.icon}</div>
          <span class="preset-name">${f.name}</span>
        `;
        btn.addEventListener('click', () => {
          filtersGrid.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.state.globalFilter = f.id;
          this.renderCurrentFrame();
        });
        filtersGrid.appendChild(btn);
      });
    }

    // 4. Special Effects
    const effectsGrid = document.getElementById('effectsGrid');
    if (effectsGrid) {
      effectsGrid.innerHTML = '';
      SPECIAL_EFFECTS.forEach(e => {
        const btn = document.createElement('div');
        btn.className = `preset-btn ${this.state.globalEffect === e.id ? 'active' : ''}`;
        btn.innerHTML = `
          <div class="preset-preview-box">${e.icon}</div>
          <span class="preset-name">${e.name}</span>
        `;
        btn.addEventListener('click', () => {
          effectsGrid.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.state.globalEffect = e.id;
          this.renderCurrentFrame();
        });
        effectsGrid.appendChild(btn);
      });
    }
  }

  /* ------------------- ASSET DROPZONE & BACKEND UPLOAD ------------------- */
  setupDropzone() {
    const dropzone = document.getElementById('uploadDropzone');
    const fileInput = document.getElementById('fileUploadInput');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          this.handleUploadedFiles(e.dataTransfer.files);
        }
      });

      fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
          this.handleUploadedFiles(fileInput.files);
        }
      });
    }
  }

  async handleUploadedFiles(files) {
    for (const file of Array.from(files)) {
      // Send to backend via FormData
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.asset) {
            this.state.uploadedAssets.unshift(data.asset);
            this.renderAssetLibrary();
            continue;
          }
        }
      } catch (err) {
        console.warn('Backend upload fallback to local URL:', err);
      }

      // Local fallback if backend upload fails
      const url = URL.createObjectURL(file);
      let type = 'video';
      if (file.type.startsWith('audio/')) type = 'audio';
      else if (file.type.startsWith('image/')) type = 'image';

      this.state.uploadedAssets.unshift({
        id: 'asset_' + Date.now(),
        name: file.name,
        type: type,
        url: url,
        duration: 5
      });
      this.renderAssetLibrary();
    }
  }

  renderAssetLibrary() {
    const grid = document.getElementById('assetLibraryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    this.state.uploadedAssets.forEach(asset => {
      const card = document.createElement('div');
      card.className = 'asset-card';

      let thumbContent = `<span style="font-size: 32px;">${asset.type === 'audio' ? '🎵' : asset.type === 'image' ? '🖼️' : '🎬'}</span>`;
      if (asset.thumbnailUrl) {
        thumbContent = `<img src="${asset.thumbnailUrl}" alt="thumb" />`;
      }

      card.innerHTML = `
        <div class="asset-thumb-container">
          ${thumbContent}
          <span class="asset-badge">${Math.round(asset.duration || 5)}s</span>
        </div>
        <div class="asset-info">
          <span class="asset-name" title="${asset.name}">${asset.name}</span>
          <button class="btn-add-asset" title="Add to timeline">+</button>
        </div>
      `;

      card.querySelector('.btn-add-asset').addEventListener('click', (e) => {
        e.stopPropagation();
        this.addAssetToTimeline(asset);
      });

      card.addEventListener('click', () => {
        this.addAssetToTimeline(asset);
      });

      grid.appendChild(card);
    });
  }

  addAssetToTimeline(asset) {
    let trackType = 'video';
    if (asset.type === 'audio') trackType = 'audio';
    if (asset.type === 'image') trackType = 'overlay';

    this.timeline.addClip({
      trackType: trackType,
      mediaType: asset.type,
      name: asset.name,
      url: asset.url,
      startTime: this.timeline.currentTime,
      duration: asset.duration || 5,
      scale: 1,
      rotation: 0,
      opacity: 1,
      speed: 1,
      volume: 1
    });
  }

  /* ------------------- CONTROLS & INSPECTOR ------------------- */
  setupHeaderControls() {
    const titleInput = document.getElementById('projectTitleInput');
    if (titleInput) {
      titleInput.addEventListener('change', (e) => {
        this.state.projectTitle = e.target.value;
      });
    }

    const aspectSelect = document.getElementById('aspectRatioSelect');
    if (aspectSelect) {
      aspectSelect.addEventListener('change', (e) => {
        this.renderer.setAspectRatio(e.target.value);
        this.renderCurrentFrame();
      });
    }

    const safeZoneBtn = document.getElementById('btnToggleSafeZones');
    if (safeZoneBtn) {
      safeZoneBtn.addEventListener('click', () => {
        this.renderer.showSafeZones = !this.renderer.showSafeZones;
        safeZoneBtn.classList.toggle('active', this.renderer.showSafeZones);
        this.renderCurrentFrame();
      });
    }

    // Export video modal & execution (Server FFmpeg vs Browser MediaRecorder)
    const exportBtn = document.getElementById('btnExportVideo');
    const exportModal = document.getElementById('exportModalOverlay');
    const closeModalBtn = document.getElementById('btnCancelExport');
    const startExportBtn = document.getElementById('btnStartExport');
    const progressContainer = document.getElementById('exportProgressContainer');
    const progressBarFill = document.getElementById('exportProgressBarFill');
    const progressText = document.getElementById('exportProgressText');
    const engineSelect = document.getElementById('exportEngineSelect');

    if (exportBtn && exportModal) {
      exportBtn.addEventListener('click', () => {
        this.pause();
        exportModal.classList.add('active');
        if (progressContainer) progressContainer.style.display = 'none';
        if (startExportBtn) startExportBtn.style.display = 'block';
      });

      closeModalBtn.addEventListener('click', () => {
        this.exporter.cancelExport();
        exportModal.classList.remove('active');
      });

      startExportBtn.addEventListener('click', async () => {
        if (progressContainer) progressContainer.style.display = 'flex';
        startExportBtn.style.display = 'none';

        const chosenEngine = engineSelect ? engineSelect.value : 'ffmpeg';

        if (chosenEngine === 'ffmpeg' && this.backendOnline) {
          // SERVER-SIDE FFMPEG RENDER
          if (progressText) progressText.textContent = 'Server FFmpeg: Transcoding & Rendering MP4...';
          if (progressBarFill) progressBarFill.style.width = '45%';

          try {
            const res = await fetch('/api/render', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clips: this.timeline.clips,
                totalDuration: this.timeline.totalDuration,
                aspectRatio: this.renderer.aspectRatio,
                adjustments: this.state.adjustments
              })
            });

            const data = await res.json();
            if (data.success && data.url) {
              if (progressBarFill) progressBarFill.style.width = '100%';
              if (progressText) progressText.textContent = 'Rendering complete! Downloading MP4...';

              const a = document.createElement('a');
              a.href = data.url;
              a.download = data.filename || 'local_video_render.mp4';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);

              setTimeout(() => exportModal.classList.remove('active'), 1500);
              return;
            } else {
              console.warn('FFmpeg render fallback to browser:', data.error);
            }
          } catch (err) {
            console.warn('FFmpeg server render failed, falling back to browser canvas:', err);
          }
        }

        // BROWSER CANVAS RECORDER FALLBACK
        try {
          const result = await this.exporter.exportVideo(
            {
              clips: this.timeline.clips,
              totalDuration: this.timeline.totalDuration,
              globalAdjustments: {
                filter: this.state.globalFilter,
                ...this.state.adjustments
              },
              globalEffect: this.state.globalEffect
            },
            { fps: 30 },
            (percent) => {
              if (progressBarFill) progressBarFill.style.width = percent + '%';
              if (progressText) progressText.textContent = `Browser Render: ${percent}%`;
            }
          );

          if (result && result.url) {
            const a = document.createElement('a');
            a.href = result.url;
            a.download = `${this.state.projectTitle || 'Local_Video'}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            if (progressText) progressText.textContent = 'Export Complete! Downloaded.';
            setTimeout(() => exportModal.classList.remove('active'), 1500);
          }
        } catch (err) {
          console.error('Export failed:', err);
          if (progressText) progressText.textContent = 'Export error. Try again.';
          startExportBtn.style.display = 'block';
        }
      });
    }
  }

  setupTransportControls() {
    const playBtn = document.getElementById('btnPlay');
    if (playBtn) playBtn.addEventListener('click', () => this.togglePlay());

    const stepBackBtn = document.getElementById('btnStepBack');
    if (stepBackBtn) {
      stepBackBtn.addEventListener('click', () => {
        this.timeline.seek(Math.max(0, this.timeline.currentTime - 1 / 30));
      });
    }

    const stepForwardBtn = document.getElementById('btnStepForward');
    if (stepForwardBtn) {
      stepForwardBtn.addEventListener('click', () => {
        this.timeline.seek(Math.min(this.timeline.totalDuration, this.timeline.currentTime + 1 / 30));
      });
    }

    const rewindBtn = document.getElementById('btnRewind');
    if (rewindBtn) {
      rewindBtn.addEventListener('click', () => {
        this.timeline.seek(0);
      });
    }

    // Timeline action toolbar
    const splitBtn = document.getElementById('btnSplitClip');
    if (splitBtn) splitBtn.addEventListener('click', () => this.timeline.splitSelectedClip());

    const deleteBtn = document.getElementById('btnDeleteClip');
    if (deleteBtn) deleteBtn.addEventListener('click', () => this.timeline.deleteSelectedClip());

    const duplicateBtn = document.getElementById('btnDuplicateClip');
    if (duplicateBtn) duplicateBtn.addEventListener('click', () => this.timeline.duplicateSelectedClip());

    const zoomInBtn = document.getElementById('btnZoomIn');
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.timeline.zoom(20));

    const zoomOutBtn = document.getElementById('btnZoomOut');
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.timeline.zoom(-20));
  }

  setupInspectorControls() {
    this.bindRangeInput('inspectorScale', 'scale', 0.1, 4, 1);
    this.bindRangeInput('inspectorRotation', 'rotation', -180, 180, 0);
    this.bindRangeInput('inspectorOpacity', 'opacity', 0, 1, 1);
    this.bindRangeInput('inspectorSpeed', 'speed', 0.25, 4, 1);
    this.bindRangeInput('inspectorVolume', 'volume', 0, 2, 1);

    const textInput = document.getElementById('inspectorTextContent');
    if (textInput) {
      textInput.addEventListener('input', (e) => {
        if (this.timeline.selectedClip && this.timeline.selectedClip.trackType === 'text') {
          this.timeline.selectedClip.text = e.target.value;
          this.timeline.renderLanes();
          this.renderCurrentFrame();
        }
      });
    }

    const textColor = document.getElementById('inspectorTextColor');
    if (textColor) {
      textColor.addEventListener('input', (e) => {
        if (this.timeline.selectedClip && this.timeline.selectedClip.trackType === 'text') {
          this.timeline.selectedClip.fill = e.target.value;
          this.renderCurrentFrame();
        }
      });
    }

    const strokeColor = document.getElementById('inspectorStrokeColor');
    if (strokeColor) {
      strokeColor.addEventListener('input', (e) => {
        if (this.timeline.selectedClip && this.timeline.selectedClip.trackType === 'text') {
          this.timeline.selectedClip.stroke = e.target.value;
          this.renderCurrentFrame();
        }
      });
    }

    ['brightness', 'contrast', 'saturation', 'hue', 'blur'].forEach(param => {
      const input = document.getElementById(`adj_${param}`);
      const num = document.getElementById(`adj_${param}_num`);
      if (input) {
        input.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          this.state.adjustments[param] = val;
          if (num) num.textContent = val;
          this.renderCurrentFrame();
        });
      }
    });
  }

  bindRangeInput(elementId, property, min, max, defaultVal) {
    const slider = document.getElementById(elementId);
    const num = document.getElementById(elementId + 'Num');

    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (num) num.value = val;
        if (this.timeline.selectedClip) {
          this.timeline.selectedClip[property] = val;
          this.renderCurrentFrame();
        }
      });
    }
  }

  onClipSelect(clip) {
    const inspectorEmpty = document.getElementById('inspectorEmptyState');
    const inspectorVideo = document.getElementById('inspectorVideoSection');
    const inspectorText = document.getElementById('inspectorTextSection');

    if (!clip) {
      if (inspectorEmpty) inspectorEmpty.style.display = 'block';
      if (inspectorVideo) inspectorVideo.style.display = 'none';
      if (inspectorText) inspectorText.style.display = 'none';
      return;
    }

    if (inspectorEmpty) inspectorEmpty.style.display = 'none';

    if (clip.trackType === 'text') {
      if (inspectorVideo) inspectorVideo.style.display = 'none';
      if (inspectorText) inspectorText.style.display = 'flex';

      const textInput = document.getElementById('inspectorTextContent');
      if (textInput) textInput.value = clip.text || '';
    } else {
      if (inspectorText) inspectorText.style.display = 'none';
      if (inspectorVideo) inspectorVideo.style.display = 'flex';

      const scaleSlider = document.getElementById('inspectorScale');
      if (scaleSlider) scaleSlider.value = clip.scale || 1;
      const rotSlider = document.getElementById('inspectorRotation');
      if (rotSlider) rotSlider.value = clip.rotation || 0;
      const opSlider = document.getElementById('inspectorOpacity');
      if (opSlider) opSlider.value = clip.opacity !== undefined ? clip.opacity : 1;
      const speedSlider = document.getElementById('inspectorSpeed');
      if (speedSlider) speedSlider.value = clip.speed || 1;
      const volSlider = document.getElementById('inspectorVolume');
      if (volSlider) volSlider.value = clip.volume !== undefined ? clip.volume : 1;
    }
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.code === 'KeyS' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.saveProject();
      } else if (e.code === 'KeyS' || (e.ctrlKey && e.code === 'KeyB')) {
        e.preventDefault();
        this.timeline.splitSelectedClip();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        this.timeline.deleteSelectedClip();
      } else if (e.ctrlKey && e.code === 'KeyD') {
        e.preventDefault();
        this.timeline.duplicateSelectedClip();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        this.timeline.seek(Math.max(0, this.timeline.currentTime - 1 / 30));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        this.timeline.seek(Math.min(this.timeline.totalDuration, this.timeline.currentTime + 1 / 30));
      } else if (e.code === 'Home') {
        e.preventDefault();
        this.timeline.seek(0);
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new CapCutApp();
});
