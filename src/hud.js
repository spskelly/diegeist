import { STAT_NAMES } from './constants.js';

const STATUS_EFFECT_LABELS = {
  thorns: 'Thorns',
  fortify: 'Fortify',
  iron_skin: 'Iron Skin',
  war_cry: 'War Cry',
  regeneration: 'Regen',
  lucky_strike: 'Lucky',
  mana_shield: 'Shield',
};

export class HUD {
  constructor(ctx, canvasWidth, canvasHeight) {
    this.ctx = ctx;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.baseHudHeight = 172;
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

  drawBeltIcon(ctx, item, x, y, size) {
    ctx.fillStyle = '#242a32';
    ctx.fillRect(x, y, size, size);
    if (!item) return;

    const effect = item.effect || '';
    if (effect === 'heal') {
      ctx.fillStyle = '#56d26d';
      ctx.fillRect(x + Math.floor(size * 0.4), y + Math.floor(size * 0.2), Math.max(2, Math.floor(size * 0.2)), Math.floor(size * 0.6));
      ctx.fillRect(x + Math.floor(size * 0.2), y + Math.floor(size * 0.4), Math.floor(size * 0.6), Math.max(2, Math.floor(size * 0.2)));
      return;
    }
    if (effect === 'aoe_damage') {
      ctx.fillStyle = '#ff8840';
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, Math.floor(size * 0.28), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd27a';
      ctx.fillRect(x + Math.floor(size * 0.45), y + Math.floor(size * 0.12), Math.max(2, Math.floor(size * 0.1)), Math.floor(size * 0.2));
      return;
    }
    if (effect === 'reveal_map') {
      ctx.fillStyle = '#70b7ff';
      ctx.fillRect(x + Math.floor(size * 0.2), y + Math.floor(size * 0.2), Math.floor(size * 0.6), Math.floor(size * 0.6));
      ctx.fillStyle = '#cde8ff';
      ctx.fillRect(x + Math.floor(size * 0.32), y + Math.floor(size * 0.32), Math.floor(size * 0.12), Math.floor(size * 0.12));
      ctx.fillRect(x + Math.floor(size * 0.56), y + Math.floor(size * 0.5), Math.floor(size * 0.12), Math.floor(size * 0.12));
      return;
    }
    if (effect === 'teleport') {
      ctx.fillStyle = '#d090ff';
      ctx.fillRect(x + Math.floor(size * 0.45), y + Math.floor(size * 0.15), Math.max(2, Math.floor(size * 0.1)), Math.floor(size * 0.7));
      ctx.fillRect(x + Math.floor(size * 0.25), y + Math.floor(size * 0.35), Math.floor(size * 0.5), Math.max(2, Math.floor(size * 0.1)));
      return;
    }
    if (effect === 'speed_boost') {
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(x + Math.floor(size * 0.3), y + Math.floor(size * 0.2), Math.floor(size * 0.4), Math.floor(size * 0.22));
      ctx.fillRect(x + Math.floor(size * 0.45), y + Math.floor(size * 0.38), Math.floor(size * 0.15), Math.floor(size * 0.42));
      return;
    }
    if (effect === 'invisibility') {
      ctx.fillStyle = '#9aa3b2';
      ctx.fillRect(x + Math.floor(size * 0.2), y + Math.floor(size * 0.45), Math.floor(size * 0.6), Math.floor(size * 0.2));
      ctx.fillStyle = '#c8cfdb';
      ctx.fillRect(x + Math.floor(size * 0.5), y + Math.floor(size * 0.3), Math.floor(size * 0.16), Math.floor(size * 0.16));
      return;
    }

    ctx.fillStyle = '#7ad1d1';
    ctx.fillRect(x + Math.floor(size * 0.25), y + Math.floor(size * 0.25), Math.floor(size * 0.5), Math.floor(size * 0.5));
  }

  drawSkillIcon(ctx, skill, x, y, size) {
    ctx.fillStyle = '#202833';
    ctx.fillRect(x, y, size, size);
    if (!skill) return;

    const scaling = skill.statScaling || 'STR';
    if (scaling === 'DEX') {
      ctx.fillStyle = '#d6b35c';
      ctx.fillRect(x + Math.floor(size * 0.18), y + Math.floor(size * 0.45), Math.floor(size * 0.56), Math.max(2, Math.floor(size * 0.1)));
      ctx.fillRect(x + Math.floor(size * 0.65), y + Math.floor(size * 0.34), Math.floor(size * 0.2), Math.floor(size * 0.3));
      ctx.fillStyle = '#8b6b3b';
      ctx.fillRect(x + Math.floor(size * 0.12), y + Math.floor(size * 0.34), Math.floor(size * 0.08), Math.floor(size * 0.3));
    } else if (scaling === 'INT') {
      ctx.fillStyle = '#4ed6ff';
      ctx.fillRect(x + Math.floor(size * 0.42), y + Math.floor(size * 0.12), Math.floor(size * 0.16), Math.floor(size * 0.72));
      ctx.fillRect(x + Math.floor(size * 0.2), y + Math.floor(size * 0.42), Math.floor(size * 0.6), Math.floor(size * 0.16));
      ctx.fillStyle = '#b8f4ff';
      ctx.fillRect(x + Math.floor(size * 0.45), y + Math.floor(size * 0.2), Math.floor(size * 0.1), Math.floor(size * 0.1));
    } else {
      ctx.fillStyle = '#ef6666';
      ctx.fillRect(x + Math.floor(size * 0.28), y + Math.floor(size * 0.15), Math.floor(size * 0.14), Math.floor(size * 0.66));
      ctx.fillRect(x + Math.floor(size * 0.42), y + Math.floor(size * 0.56), Math.floor(size * 0.36), Math.floor(size * 0.14));
      ctx.fillStyle = '#f4bfbf';
      ctx.fillRect(x + Math.floor(size * 0.3), y + Math.floor(size * 0.2), Math.floor(size * 0.1), Math.floor(size * 0.1));
    }
  }

  draw(player, messageLog, derivedStats = null, runMaterials = null) {
    const ctx = this.ctx;
    const s = this.uiScale;
    const y = this.canvasHeight - this.hudHeight;
    const stats = derivedStats || player.stats;

    ctx.fillStyle = '#111118';
    ctx.fillRect(0, y, this.canvasWidth, this.hudHeight);
    ctx.fillStyle = '#333';
    ctx.fillRect(0, y, this.canvasWidth, 1);

    const hpBarX = Math.round(12 * s);
    const hpBarY = y + Math.round(10 * s);
    const hpBarW = Math.round(200 * s);
    const hpBarH = Math.round(18 * s);
    const hpRatio = player.hp / player.maxHp;

    ctx.fillStyle = '#400';
    ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);

    const hpColor = hpRatio > 0.5 ? '#0c0' : hpRatio > 0.25 ? '#cc0' : '#c00';
    ctx.fillStyle = hpColor;
    ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH);

    ctx.fillStyle = '#fff';
    ctx.font = `${Math.round(12 * s)}px monospace`;
    ctx.fillText(`HP: ${player.hp}/${player.maxHp}`, hpBarX + Math.round(5 * s), hpBarY + Math.round(14 * s));

    const slotSize = Math.round(26 * s);
    const slotGap = Math.round(7 * s);
    const slotCount = 3;
    const slotAreaW = slotCount * slotSize + (slotCount - 1) * slotGap;
    const rightInset = Math.round(10 * s);
    const rightPanelPad = Math.round(8 * s);
    const rightPanelW = slotAreaW + rightPanelPad * 2;
    const rightPanelH = slotSize * 2 + Math.round(38 * s);
    const rightPanelX = this.canvasWidth - rightPanelW - rightInset;
    const rightPanelY = y + Math.round(6 * s);
    const beltX = rightPanelX + rightPanelPad;
    const beltY = rightPanelY + Math.round(18 * s);
    const skillY = beltY + slotSize + Math.round(18 * s);
    const skillX = beltX;

    ctx.fillStyle = '#19202a';
    ctx.fillRect(rightPanelX, rightPanelY, rightPanelW, rightPanelH);
    ctx.strokeStyle = '#3d4b59';
    ctx.strokeRect(rightPanelX, rightPanelY, rightPanelW, rightPanelH);

    const infoX = hpBarX + hpBarW + Math.round(18 * s);
    ctx.fillStyle = '#d9e1ea';
    ctx.font = `${Math.round(12 * s)}px monospace`;
    ctx.fillText(`Floor ${player.floorNumber}`, infoX, hpBarY + Math.round(14 * s));
    ctx.fillText(`Essence ${player.gold}`, infoX + Math.round(110 * s), hpBarY + Math.round(14 * s));

    // Run materials
    if (runMaterials) {
      const matNames = { timber: 'TMB', stone: 'STN', iron: 'IRN', crystal: 'CRY', aether: 'ATH' };
      const matColors = { timber: '#8b6b3b', stone: '#9a9a8a', iron: '#7a8a9a', crystal: '#9a7ac8', aether: '#c8a0ff' };
      let matX = infoX;
      const matY = hpBarY + Math.round(30 * s);
      ctx.font = `${Math.round(10 * s)}px monospace`;
      for (const [key, abbr] of Object.entries(matNames)) {
        const val = runMaterials[key] || 0;
        if (val === 0) continue;
        ctx.fillStyle = matColors[key];
        const label = `${abbr}:${val}`;
        ctx.fillText(label, matX, matY);
        matX += ctx.measureText(label).width + Math.round(10 * s);
      }
    }

    ctx.fillStyle = '#90a0b0';
    ctx.font = `${Math.round(10 * s)}px monospace`;
    ctx.fillText('BELT', beltX, beltY - Math.round(5 * s));
    ctx.fillText('SKILLS', skillX, skillY - Math.round(5 * s));

    for (let i = 0; i < 3; i++) {
      const slotX = beltX + i * (slotSize + slotGap);
      ctx.strokeStyle = '#5a6673';
      ctx.strokeRect(slotX, beltY, slotSize, slotSize);
      this.drawBeltIcon(ctx, player.belt[i], slotX + 1, beltY + 1, slotSize - 2);
      ctx.fillStyle = '#d3dde7';
      ctx.font = `${Math.round(10 * s)}px monospace`;
      ctx.fillText(`${i + 1}`, slotX + Math.round(3 * s), beltY + slotSize - Math.round(3 * s));
    }

    const skills = player.activeSkills || [];
    for (let i = 0; i < 3; i++) {
      const slotX = skillX + i * (slotSize + slotGap);
      const skill = skills[i] || null;
      ctx.strokeStyle = '#5a6673';
      ctx.strokeRect(slotX, skillY, slotSize, slotSize);
      this.drawSkillIcon(ctx, skill, slotX + 1, skillY + 1, slotSize - 2);
      ctx.fillStyle = '#d3dde7';
      ctx.font = `${Math.round(10 * s)}px monospace`;
      ctx.fillText(i === 0 ? 'Q' : i === 1 ? 'E' : 'R', slotX + Math.round(3 * s), skillY + slotSize - Math.round(3 * s));
      if (skill && skill.currentCooldown > 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(slotX + 1, skillY + 1, slotSize - 2, slotSize - 2);
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.round(11 * s)}px monospace`;
        ctx.fillText(`${skill.currentCooldown}`, slotX + Math.round(8 * s), skillY + Math.round(16 * s));
      }
    }

    const statLine = STAT_NAMES.map(stat => `${stat}:${stats[stat] || 0}`).join('  ');
    ctx.fillStyle = '#b6c2cd';
    ctx.font = `${Math.round(11 * s)}px monospace`;
    ctx.fillText(statLine, Math.round(12 * s), y + Math.round(50 * s));

    // Active status effects
    if (player.statusEffects && player.statusEffects.length > 0) {
      ctx.font = `${Math.round(10 * s)}px monospace`;
      const buffStrs = player.statusEffects.map(e => {
        const label = STATUS_EFFECT_LABELS[e.type] || e.type;
        return e.turnsRemaining < 900 ? `${label}(${e.turnsRemaining})` : label;
      });
      ctx.fillStyle = '#7ad1a0';
      ctx.fillText(buffStrs.join('  '), Math.round(12 * s), y + Math.round(62 * s));
    }

    const messages = messageLog.getRecent(4);
    ctx.font = `${Math.round(11 * s)}px monospace`;
    const messageStartY = y + Math.round(72 * s);
    const messageLineH = Math.round(16 * s);
    for (let i = 0; i < messages.length; i++) {
      const alpha = i === messages.length - 1 ? 1.0 : 0.5 + (i / messages.length) * 0.3;
      ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`;
      ctx.fillText(messages[i].text, Math.round(12 * s), messageStartY + i * messageLineH);
    }

    ctx.fillStyle = '#7f8a94';
    ctx.font = `${Math.round(11 * s)}px monospace`;
    const line1 = 'Move: Arrows  Attack: WASD  Wait: Space/.  Pickup: G';
    const line2 = 'Skills: Q/E/R  Belt: 1/2/3  Inventory: I/Tab  Stats: P  Descend stairs: >';
    ctx.fillText(line1, Math.round(12 * s), y + this.hudHeight - Math.round(28 * s));
    ctx.fillText(line2, Math.round(12 * s), y + this.hudHeight - Math.round(10 * s));
  }
}
