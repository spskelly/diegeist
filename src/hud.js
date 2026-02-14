import { STAT_NAMES } from './constants.js';

export class HUD {
  constructor(ctx, canvasWidth, canvasHeight) {
    this.ctx = ctx;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.baseHudHeight = 132;
    this.uiScale = 1;
    this.hudHeight = this.baseHudHeight;
    this.resize(canvasWidth, canvasHeight);
  }

  resize(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    const minDim = Math.min(canvasWidth, canvasHeight);
    this.uiScale = Math.max(1, Math.min(1.8, minDim / 900));
    this.hudHeight = Math.round(this.baseHudHeight * this.uiScale);
  }

  draw(player, messageLog, derivedStats = null) {
    const ctx = this.ctx;
    const s = this.uiScale;
    const y = this.canvasHeight - this.hudHeight;
    const stats = derivedStats || player.stats;

    ctx.fillStyle = '#111118';
    ctx.fillRect(0, y, this.canvasWidth, this.hudHeight);
    ctx.fillStyle = '#333';
    ctx.fillRect(0, y, this.canvasWidth, 1);

    const hpBarX = Math.round(10 * s);
    const hpBarY = y + Math.round(8 * s);
    const hpBarW = Math.round(150 * s);
    const hpBarH = Math.round(14 * s);
    const hpRatio = player.hp / player.maxHp;

    ctx.fillStyle = '#400';
    ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);

    const hpColor = hpRatio > 0.5 ? '#0c0' : hpRatio > 0.25 ? '#cc0' : '#c00';
    ctx.fillStyle = hpColor;
    ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH);

    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(10 * s)}px monospace`;
    ctx.fillText(`HP: ${player.hp}/${player.maxHp}`, hpBarX + Math.round(4 * s), hpBarY + Math.round(11 * s));

    ctx.fillText(`Floor ${player.floorNumber}`, hpBarX + hpBarW + Math.round(20 * s), hpBarY + Math.round(11 * s));
    ctx.fillText(`Essence: ${player.gold}`, hpBarX + hpBarW + Math.round(80 * s), hpBarY + Math.round(11 * s));

    const beltSlotW = Math.round(30 * s);
    const beltSlotH = Math.round(14 * s);
    const beltGap = Math.round(6 * s);
    const beltCount = 3;
    const beltAreaW = beltCount * beltSlotW + (beltCount - 1) * beltGap;
    const beltX = this.canvasWidth - beltAreaW - Math.round(12 * s);
    for (let i = 0; i < 3; i++) {
      const slotX = beltX + i * (beltSlotW + beltGap);
      ctx.strokeStyle = '#555';
      ctx.strokeRect(slotX, hpBarY, beltSlotW, beltSlotH);
      ctx.fillStyle = '#888';
      ctx.fillText(`${i + 1}`, slotX + Math.round(2 * s), hpBarY + Math.round(11 * s));
      if (player.belt[i]) {
        ctx.fillStyle = '#0ff';
        ctx.fillRect(
          slotX + Math.round(12 * s),
          hpBarY + Math.round(3 * s),
          Math.round(14 * s),
          Math.round(8 * s)
        );
      }
    }

    const statLine = STAT_NAMES.map(stat => `${stat}:${stats[stat] || 0}`).join('  ');
    ctx.fillStyle = '#b6c2cd';
    ctx.font = `${Math.round(10 * s)}px monospace`;
    ctx.fillText(statLine, Math.round(10 * s), y + Math.round(30 * s));

    const messages = messageLog.getRecent(3);
    ctx.font = `${Math.round(10 * s)}px monospace`;
    for (let i = 0; i < messages.length; i++) {
      const alpha = i === messages.length - 1 ? 1.0 : 0.5 + (i / messages.length) * 0.3;
      ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`;
      ctx.fillText(messages[i].text, Math.round(10 * s), y + Math.round(46 * s) + i * Math.round(14 * s));
    }

    ctx.fillStyle = '#7f8a94';
    ctx.font = `${Math.round(11 * s)}px monospace`;
    const line1 = 'Move: WASD/Arrows  Attack: Move into enemy  Wait: Space/.  Pickup: G';
    const line2 = 'Skills: Q/E/R  Belt: 1/2/3  Inventory: I/Tab  Stats: P  Descend stairs: >';
    ctx.fillText(line1, Math.round(10 * s), y + this.hudHeight - Math.round(24 * s));
    ctx.fillText(line2, Math.round(10 * s), y + this.hudHeight - Math.round(9 * s));
  }
}
