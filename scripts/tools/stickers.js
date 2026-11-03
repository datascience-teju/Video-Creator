/**
 * CapCut Studio - Stickers & Reactions Overlay
 */

export const STICKER_PACKS = [
  {
    category: 'Trending Emojis',
    stickers: ['🔥', '🚀', '❤️', '😂', '⚡', '💯', '✨', '👑', '🎯', '💥', '🎬', '🌟', '💀', '💡', '💎', '🍿']
  },
  {
    category: 'Creator Badges',
    stickers: ['SUBSCRIBE', 'LIKE & SHARE', 'FOLLOW', 'NEW', 'POV', 'PART 2', 'WAIT FOR IT', 'TOP 10', '🔴 REC']
  }
];

/**
 * Render sticker / badge overlay
 */
export function renderStickerClip(ctx, clip, canvasWidth, canvasHeight, currentTime) {
  const {
    sticker = '🔥',
    isBadge = false,
    x = 0.5,
    y = 0.3,
    scale = 1,
    rotation = 0,
    startTime = 0
  } = clip;

  const clipElapsed = currentTime - startTime;
  const pulse = 1 + 0.06 * Math.sin(clipElapsed * 6);

  ctx.save();
  const posX = canvasWidth * x;
  const posY = canvasHeight * y;

  ctx.translate(posX, posY);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(scale * pulse, scale * pulse);

  if (isBadge) {
    // Render creator badge with gradient background
    ctx.font = 'bold 24px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(sticker);
    const w = metrics.width + 30;
    const h = 42;

    // Glowing background
    ctx.shadowColor = '#EF476F';
    ctx.shadowBlur = 15;

    const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    grad.addColorStop(0, '#FF4081');
    grad.addColorStop(1, '#EF476F');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 8);
    ctx.fill();

    // Text label
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(sticker, 0, 1);
  } else {
    // Large emoji sticker
    ctx.font = '72px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.fillText(sticker, 0, 0);
  }

  ctx.restore();
}
