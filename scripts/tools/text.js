/**
 * CapCut Studio - Text & Title Overlay Engine
 */

export const TEXT_PRESETS = [
  {
    id: 'trending-bold',
    name: 'Bold Viral',
    style: {
      text: 'VIRAL HOOK',
      font: 'Impact, sans-serif',
      size: 54,
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeWidth: 8,
      background: 'transparent',
      animation: 'pop',
      shadow: true
    }
  },
  {
    id: 'cyber-neon',
    name: 'Neon Cyber',
    style: {
      text: 'CYBER VIBE',
      font: 'Montserrat, sans-serif',
      size: 48,
      fill: '#00F2FE',
      stroke: '#003B73',
      strokeWidth: 4,
      background: 'rgba(0,0,0,0.7)',
      animation: 'pulse',
      shadow: true
    }
  },
  {
    id: 'minimal-caption',
    name: 'Clean Subtitle',
    style: {
      text: 'Clean subtitle caption',
      font: 'Inter, sans-serif',
      size: 32,
      fill: '#FFFFFF',
      stroke: '',
      strokeWidth: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      animation: 'none',
      shadow: false
    }
  },
  {
    id: 'retro-yellow',
    name: 'Retro Highlight',
    style: {
      text: 'WAIT FOR IT...',
      font: 'Impact, sans-serif',
      size: 50,
      fill: '#FFE600',
      stroke: '#000000',
      strokeWidth: 6,
      background: 'transparent',
      animation: 'bounce',
      shadow: true
    }
  },
  {
    id: 'aesthetic-serif',
    name: 'Cinematic Title',
    style: {
      text: 'A Story In Silence',
      font: 'Georgia, serif',
      size: 42,
      fill: '#F8FAFC',
      stroke: '',
      strokeWidth: 0,
      background: 'transparent',
      animation: 'fade',
      shadow: true
    }
  }
];

/**
 * Render text clip onto the canvas context with styles and animation
 */
export function renderTextClip(ctx, clip, canvasWidth, canvasHeight, currentTime) {
  const {
    text = 'Sample Text',
    font = 'Impact, sans-serif',
    size = 48,
    fill = '#FFFFFF',
    stroke = '#000000',
    strokeWidth = 4,
    background = 'transparent',
    shadow = true,
    animation = 'none',
    x = 0.5, // Relative X (0 to 1)
    y = 0.8, // Relative Y (0 to 1)
    scale = 1,
    rotation = 0,
    startTime = 0
  } = clip;

  const clipElapsed = currentTime - startTime;
  let animScale = 1;
  let animAlpha = 1;
  let animOffsetY = 0;

  // Apply entrance animation
  if (animation === 'pop') {
    if (clipElapsed < 0.25) {
      const progress = clipElapsed / 0.25;
      animScale = 0.5 + 0.5 * Math.sin(progress * Math.PI * 0.5);
    }
  } else if (animation === 'bounce') {
    if (clipElapsed < 0.4) {
      const progress = clipElapsed / 0.4;
      animOffsetY = Math.sin(progress * Math.PI * 2) * -15;
    }
  } else if (animation === 'fade') {
    if (clipElapsed < 0.3) {
      animAlpha = clipElapsed / 0.3;
    }
  } else if (animation === 'pulse') {
    animScale = 1 + 0.05 * Math.sin(clipElapsed * 5);
  }

  ctx.save();
  ctx.globalAlpha = animAlpha;

  const posX = canvasWidth * x;
  const posY = canvasHeight * y + animOffsetY;

  ctx.translate(posX, posY);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scale * animScale, scale * animScale);

  ctx.font = `bold ${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = size * 1.2;

  // Draw background badge if configured
  if (background && background !== 'transparent') {
    ctx.fillStyle = background;
    const paddingX = 16;
    const paddingY = 8;
    const boxRadius = 6;
    const rx = -textWidth / 2 - paddingX;
    const ry = -textHeight / 2 - paddingY;
    const rw = textWidth + paddingX * 2;
    const rh = textHeight + paddingY * 2;

    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, boxRadius);
    ctx.fill();
  }

  // Draw drop shadow
  if (shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
  }

  // Draw stroke / outline
  if (stroke && strokeWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, 0, 0);
  }

  // Draw fill
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);

  ctx.restore();
}
