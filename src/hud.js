export class HUD {
  constructor(ctx, canvasWidth, canvasHeight) {
    this.ctx = ctx;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.hudHeight = 80;
  }

  resize(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
  }

  draw(player, messageLog) {
    const ctx = this.ctx;
    const y = this.canvasHeight - this.hudHeight;

    ctx.fillStyle = '#111118';
    ctx.fillRect(0, y, this.canvasWidth, this.hudHeight);
    ctx.fillStyle = '#333';
    ctx.fillRect(0, y, this.canvasWidth, 1);

    const hpBarX = 10;
    const hpBarY = y + 8;
    const hpBarW = 150;
    const hpBarH = 14;
    const hpRatio = player.hp / player.maxHp;

    ctx.fillStyle = '#400';
    ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);

    const hpColor = hpRatio > 0.5 ? '#0c0' : hpRatio > 0.25 ? '#cc0' : '#c00';
    ctx.fillStyle = hpColor;
    ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH);

    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(`HP: ${player.hp}/${player.maxHp}`, hpBarX + 4, hpBarY + 11);

    ctx.fillText(`Floor ${player.floorNumber}`, hpBarX + hpBarW + 20, hpBarY + 11);

    const beltX = this.canvasWidth - 120;
    for (let i = 0; i < 3; i++) {
      const slotX = beltX + i * 36;
      ctx.strokeStyle = '#555';
      ctx.strokeRect(slotX, hpBarY, 30, 14);
      ctx.fillStyle = '#888';
      ctx.fillText(`${i + 1}`, slotX + 2, hpBarY + 11);
      if (player.belt[i]) {
        ctx.fillStyle = '#0ff';
        ctx.fillRect(slotX + 12, hpBarY + 3, 14, 8);
      }
    }

    const messages = messageLog.getRecent(3);
    ctx.font = '10px monospace';
    for (let i = 0; i < messages.length; i++) {
      const alpha = i === messages.length - 1 ? 1.0 : 0.5 + (i / messages.length) * 0.3;
      ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`;
      ctx.fillText(messages[i].text, 10, y + 32 + i * 14);
    }
  }
}
