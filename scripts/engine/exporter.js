/**
 * CapCut Studio - MediaRecorder Video Export Engine
 */

export class VideoExporter {
  constructor(renderer, audioEngine) {
    this.renderer = renderer;
    this.audioEngine = audioEngine;
    this.isExporting = false;
  }

  async exportVideo(timelineState, options = {}, onProgress = () => {}) {
    if (this.isExporting) return;
    this.isExporting = true;

    const { fps = 30, resolution = '1080p' } = options;
    const canvas = this.renderer.canvas;
    const duration = timelineState.totalDuration || 5;

    // Set resolution scale
    const originalW = canvas.width;
    const originalH = canvas.height;

    // Setup MediaStream
    const canvasStream = canvas.captureStream(fps);
    const combinedStream = new MediaStream();

    canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));

    // Determine MIME type
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8,opus';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 6000000 // 6 Mbps high quality
    });

    const recordedChunks = [];
    recorder.ondataavailable = e => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        this.isExporting = false;
        const finalBlob = new Blob(recordedChunks, { type: 'video/webm' });
        const downloadUrl = URL.createObjectURL(finalBlob);
        resolve({ blob: finalBlob, url: downloadUrl });
      };

      recorder.onerror = err => {
        this.isExporting = false;
        reject(err);
      };

      recorder.start();

      // Render frame by frame
      const frameInterval = 1 / fps;
      let exportTime = 0;

      const renderInterval = setInterval(() => {
        if (!this.isExporting) {
          clearInterval(renderInterval);
          return;
        }

        // Render current timeline frame
        this.renderer.renderFrame({
          ...timelineState,
          currentTime: exportTime,
          isPlaying: true
        });

        // Sync videos
        this.renderer.syncVideoElements(timelineState.clips, exportTime, true);

        // Progress update
        const progress = Math.min(100, Math.floor((exportTime / duration) * 100));
        onProgress(progress);

        exportTime += frameInterval;

        if (exportTime >= duration) {
          clearInterval(renderInterval);
          onProgress(100);
          setTimeout(() => {
            recorder.stop();
          }, 200);
        }
      }, 1000 / fps);
    });
  }

  cancelExport() {
    this.isExporting = false;
  }
}
