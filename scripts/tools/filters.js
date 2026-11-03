/**
 * CapCut Studio - Filters & Color Grading Engine
 */

export const FILTER_PRESETS = [
  { id: 'normal', name: 'Original', icon: '✨', css: 'none' },
  { id: 'cyberpunk', name: 'Cyberpunk', icon: '🌆', css: 'contrast(1.4) saturate(1.8) hue-rotate(185deg)' },
  { id: 'cinematic', name: 'Cinematic', icon: '🎬', css: 'contrast(1.2) saturate(1.1) brightness(0.95) sepia(0.2)' },
  { id: 'vintage', name: '90s Vintage', icon: '📼', css: 'sepia(0.5) contrast(0.9) brightness(1.05) saturate(1.2)' },
  { id: 'noir', name: 'Film Noir', icon: '🎞️', css: 'grayscale(1) contrast(1.6) brightness(0.9)' },
  { id: 'sunset', name: 'Warm Sunset', icon: '🌅', css: 'sepia(0.35) saturate(1.6) contrast(1.1) brightness(1.05)' },
  { id: 'matrix', name: 'Matrix Green', icon: '🟢', css: 'contrast(1.5) hue-rotate(80deg) saturate(1.5)' },
  { id: 'neon', name: 'Neon Glow', icon: '⚡', css: 'contrast(1.3) saturate(2.2) brightness(1.1)' },
  { id: 'pastel', name: 'Pastel Dream', icon: '🌸', css: 'brightness(1.15) saturate(0.8) contrast(0.95)' },
  { id: 'vivid', name: 'Vivid Pop', icon: '🔥', css: 'saturate(1.7) contrast(1.2)' },
  { id: 'cold', name: 'Arctic Cool', icon: '❄️', css: 'hue-rotate(190deg) saturate(1.1) brightness(1.02)' },
  { id: 'bleach', name: 'Bleach Bypass', icon: '🌪️', css: 'contrast(1.5) saturate(0.6) brightness(1.1)' }
];

export const SPECIAL_EFFECTS = [
  { id: 'none', name: 'None', icon: '🚫' },
  { id: 'vignette', name: 'Vignette', icon: '🔘' },
  { id: 'glitch', name: 'VHS Glitch', icon: '📺' },
  { id: 'blur', name: 'Soft Blur', icon: '💧' },
  { id: 'scanlines', name: 'CRT Scanlines', icon: '📻' },
  { id: 'shake', name: 'Camera Shake', icon: '📳' }
];

/**
 * Apply filters, color adjustments, and special effects to the canvas context
 */
export function applyVideoEffects(ctx, canvasWidth, canvasHeight, adjustments = {}, effectId = 'none', time = 0) {
  const {
    filter = 'normal',
    brightness = 100,
    contrast = 100,
    saturation = 100,
    hue = 0,
    blur = 0
  } = adjustments;

  // Find preset CSS filter
  const preset = FILTER_PRESETS.find(p => p.id === filter) || FILTER_PRESETS[0];
  let filterStr = '';

  if (preset.css && preset.css !== 'none') {
    filterStr += `${preset.css} `;
  }

  if (brightness !== 100) filterStr += `brightness(${brightness}%) `;
  if (contrast !== 100) filterStr += `contrast(${contrast}%) `;
  if (saturation !== 100) filterStr += `saturate(${saturation}%) `;
  if (hue !== 0) filterStr += `hue-rotate(${hue}deg) `;
  if (blur > 0) filterStr += `blur(${blur}px) `;

  ctx.filter = filterStr.trim() || 'none';

  // Return a callback to execute post-draw canvas overlays (e.g., Vignette, Glitch, Scanlines)
  return () => {
    ctx.filter = 'none';

    if (effectId === 'vignette') {
      const gradient = ctx.createRadialGradient(
        canvasWidth / 2, canvasHeight / 2, Math.min(canvasWidth, canvasHeight) * 0.35,
        canvasWidth / 2, canvasHeight / 2, Math.max(canvasWidth, canvasHeight) * 0.75
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.65)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
    else if (effectId === 'scanlines') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      for (let y = 0; y < canvasHeight; y += 4) {
        ctx.fillRect(0, y, canvasWidth, 2);
      }
    }
    else if (effectId === 'glitch') {
      // Periodic chromatic slice shift
      const glitchActive = (Math.sin(time * 12) > 0.7);
      if (glitchActive) {
        const sliceY = (Math.sin(time * 30) * 0.5 + 0.5) * canvasHeight;
        const sliceH = 20 + Math.random() * 40;
        const offset = (Math.random() - 0.5) * 25;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 242, 254, 0.2)';
        ctx.fillRect(0, sliceY, canvasWidth, sliceH);
        ctx.drawImage(ctx.canvas, 0, sliceY, canvasWidth, sliceH, offset, sliceY, canvasWidth, sliceH);
        ctx.restore();
      }
    }
  };
}
