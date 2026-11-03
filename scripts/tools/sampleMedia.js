/**
 * CapCut Studio - Dynamic Sample Media Generator
 * Generates sample video and audio clips on the fly using HTML5 Canvas & Web Audio API
 */

export async function generateSampleClips() {
  const clips = [];

  // Generate Sample Video 1: "Neon Cyber Grid"
  try {
    const video1Blob = await createProceduralVideo((ctx, w, h, t) => {
      // Dark cyber background
      ctx.fillStyle = '#0b0c10';
      ctx.fillRect(0, 0, w, h);

      // Perspective 3D neon grid
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const horizon = h * 0.45;
      const speed = (t * 80) % 40;

      // Vertical perspective lines
      for (let x = -w * 0.5; x < w * 1.5; x += 60) {
        ctx.moveTo(w / 2 + (x - w / 2) * 0.1, horizon);
        ctx.lineTo(x, h);
      }

      // Horizontal lines moving forward
      for (let y = horizon; y < h; y += 25) {
        const offset = Math.pow((y - horizon) / (h - horizon), 2) * (h - horizon) + speed;
        if (horizon + offset < h) {
          ctx.moveTo(0, horizon + offset);
          ctx.lineTo(w, horizon + offset);
        }
      }
      ctx.stroke();

      // Glowing cyber sun
      const sunGrad = ctx.createRadialGradient(w / 2, horizon - 20, 10, w / 2, horizon - 20, 90);
      sunGrad.addColorStop(0, '#ff4081');
      sunGrad.addColorStop(0.7, '#ff007f');
      sunGrad.addColorStop(1, 'rgba(255, 0, 127, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(w / 2, horizon - 20, 90, 0, Math.PI * 2);
      ctx.fill();

      // Floating geometric text / shapes
      ctx.font = 'bold 36px Montserrat, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 15;
      ctx.fillText('LOCAL VIDEO STUDIO', w / 2, horizon - 140);
      ctx.shadowBlur = 0;
    }, 640, 360, 5); // 5 seconds duration

    clips.push({
      id: 'sample-video-1',
      type: 'video',
      name: 'Cyber Grid Loop.mp4',
      url: URL.createObjectURL(video1Blob),
      duration: 5,
      width: 640,
      height: 360
    });
  } catch (err) {
    console.warn('Could not generate sample video 1:', err);
  }

  // Generate Sample Video 2: "Particles & Light"
  try {
    const video2Blob = await createProceduralVideo((ctx, w, h, t) => {
      // Cosmic gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#1a0826');
      grad.addColorStop(1, '#0c1b33');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Glowing pulsing rings
      for (let i = 0; i < 5; i++) {
        const radius = ((t * 60 + i * 50) % 250);
        ctx.strokeStyle = `hsla(${200 + i * 30}, 100%, 65%, ${1 - radius / 250})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.font = 'bold 34px Montserrat, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#9b51e0';
      ctx.shadowBlur = 12;
      ctx.fillText('DYNAMIC MOTION 2', w / 2, h * 0.85);
      ctx.shadowBlur = 0;
    }, 640, 360, 5);

    clips.push({
      id: 'sample-video-2',
      type: 'video',
      name: 'Cosmic Motion.mp4',
      url: URL.createObjectURL(video2Blob),
      duration: 5,
      width: 640,
      height: 360
    });
  } catch (err) {
    console.warn('Could not generate sample video 2:', err);
  }

  // Generate Sample Audio: "Upbeat Synth Groove"
  try {
    const audioBlob = generateSynthAudio(8);
    clips.push({
      id: 'sample-audio-1',
      type: 'audio',
      name: 'Upbeat Lo-Fi Beat.mp3',
      url: URL.createObjectURL(audioBlob),
      duration: 8
    });
  } catch (err) {
    console.warn('Could not generate sample audio:', err);
  }

  return clips;
}

/**
 * Creates a video Blob using canvas MediaRecorder
 */
function createProceduralVideo(drawFn, width, height, durationSeconds) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(30);
    let mimeType = 'video/webm;codecs=vp8';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };

    recorder.onerror = reject;

    recorder.start();

    const fps = 30;
    const totalFrames = durationSeconds * fps;
    let frame = 0;

    const interval = setInterval(() => {
      const time = frame / fps;
      drawFn(ctx, width, height, time);
      frame++;

      if (frame >= totalFrames) {
        clearInterval(interval);
        setTimeout(() => recorder.stop(), 100);
      }
    }, 1000 / fps);
  });
}

/**
 * Generates an audio WAV file with a rhythmic synth beat using offline Web Audio
 */
function generateSynthAudio(durationSeconds = 8) {
  const sampleRate = 44100;
  const numSamples = durationSeconds * sampleRate;
  const buffer = new Float32Array(numSamples);

  const bpm = 110;
  const beatInterval = sampleRate * (60 / bpm);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    // Bass synth chord progression
    const chordFreq = [110, 130.81, 146.83, 164.81][Math.floor((t * (bpm / 60)) / 4) % 4];
    sample += Math.sin(2 * Math.PI * chordFreq * t) * 0.2;
    sample += Math.sin(2 * Math.PI * (chordFreq * 1.5) * t) * 0.1;

    // Kick drum on each beat
    const beatPos = i % beatInterval;
    if (beatPos < 0.2 * sampleRate) {
      const kickT = beatPos / sampleRate;
      const kickFreq = Math.max(40, 160 * Math.exp(-kickT * 25));
      sample += Math.sin(2 * Math.PI * kickFreq * kickT) * Math.exp(-kickT * 15) * 0.6;
    }

    // Hi-hat sound
    const hatInterval = beatInterval / 2;
    const hatPos = i % hatInterval;
    if (hatPos < 0.05 * sampleRate) {
      const hatT = hatPos / sampleRate;
      sample += (Math.random() * 2 - 1) * Math.exp(-hatT * 60) * 0.15;
    }

    buffer[i] = Math.max(-1, Math.min(1, sample));
  }

  return encodeWAV(buffer, sampleRate);
}

/**
 * Encode Float32Array into a WAV Blob
 */
function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
