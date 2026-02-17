import { PLAYER_CLASSES, STAT_NAMES, STAT_DESCRIPTIONS, TILE } from './constants.js';
import { getEquippedStats } from './inventory.js';
import { ACHIEVEMENTS } from './progression.js';
import { getXPForNextLevel, XP_TABLE, canInvestSkill, SKILL_TREES } from './skill-tree.js';
import { MATERIAL_COLORS } from './resources.js';
import {
  getRarityColor,
  formatSlotName,
  getClassLabel,
  truncateLabel,
  getEquipmentRows,
  getInventoryCapacity,
  getInventoryGridColumns,
  getScrollView,
  drawScrollIndicators,
  getHubMenuOptions,
  getItemSellValue,
  getSelectedAchievement,
  getSkillTreeNodes,
  getStashPaneItems,
  getEntityStatsWithEquipment,
  getNaturalRegenInterval,
  wrapTextLines,
} from './game-utils.js';
import { hasSavedRun } from './game-save.js';
import { BIOME_KEYS } from './audio.js';

export function drawInventoryItemIcon(game, ctx, item, x, y, size) {
  if (!item) return;

  const sprite = item.sprite ? game.sprites.get(item.sprite) : null;
  if (sprite) {
    ctx.drawImage(sprite, x, y, size, size);
    return;
  }

  const px = Math.floor(x);
  const py = Math.floor(y);
  const s = Math.floor(size);
  const inner = Math.max(2, Math.floor(s * 0.2));
  const w = s - inner * 2;
  const h = s - inner * 2;

  if (item.type === 'weapon') {
    ctx.fillStyle = '#e4c580';
    ctx.fillRect(px + inner + Math.floor(w * 0.52), py + inner, Math.max(2, Math.floor(w * 0.16)), h);
    ctx.fillStyle = '#7d5b3f';
    ctx.fillRect(px + inner + Math.floor(w * 0.45), py + inner + Math.floor(h * 0.58), Math.max(2, Math.floor(w * 0.3)), Math.max(2, Math.floor(h * 0.18)));
    return;
  }

  if (item.type === 'armor') {
    ctx.fillStyle = '#95b0c9';
    if (item.slot === 'head') {
      ctx.fillRect(px + inner + Math.floor(w * 0.2), py + inner + Math.floor(h * 0.2), Math.floor(w * 0.6), Math.floor(h * 0.45));
      ctx.fillRect(px + inner + Math.floor(w * 0.3), py + inner + Math.floor(h * 0.62), Math.floor(w * 0.4), Math.floor(h * 0.18));
    } else if (item.slot === 'legs') {
      ctx.fillRect(px + inner + Math.floor(w * 0.25), py + inner + Math.floor(h * 0.15), Math.floor(w * 0.2), Math.floor(h * 0.7));
      ctx.fillRect(px + inner + Math.floor(w * 0.55), py + inner + Math.floor(h * 0.15), Math.floor(w * 0.2), Math.floor(h * 0.7));
    } else {
      ctx.fillRect(px + inner + Math.floor(w * 0.18), py + inner + Math.floor(h * 0.12), Math.floor(w * 0.64), Math.floor(h * 0.76));
    }
    return;
  }

  if (item.type === 'accessory') {
    ctx.strokeStyle = '#e9d48e';
    ctx.lineWidth = Math.max(2, Math.floor(s * 0.09));
    ctx.beginPath();
    ctx.arc(px + Math.floor(s / 2), py + Math.floor(s / 2), Math.floor(w * 0.32), 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (item.type === 'consumable') {
    const effectColor = item.effect === 'heal'
      ? '#63d676'
      : item.effect === 'aoe_damage'
        ? '#ff9152'
        : item.effect === 'teleport'
          ? '#c092ff'
          : item.effect === 'speed_boost'
            ? '#ffd45a'
            : '#7dc9ff';
    ctx.fillStyle = effectColor;
    ctx.fillRect(px + inner + Math.floor(w * 0.3), py + inner + Math.floor(h * 0.15), Math.floor(w * 0.4), Math.floor(h * 0.62));
    ctx.fillStyle = '#d9e3ef';
    ctx.fillRect(px + inner + Math.floor(w * 0.38), py + inner, Math.floor(w * 0.24), Math.floor(h * 0.16));
    return;
  }

  ctx.fillStyle = '#8da1b5';
  ctx.fillRect(px + inner, py + inner, w, h);
}

export function getSelectedInspectTarget(game) {
  if (!game.player) return { item: null, slotLabel: null };
  if (game.inventorySection === 'items') {
    const idx = game.inventoryCursorByTab.inventory || 0;
    return { item: game.player.inventory[idx] || null, slotLabel: null };
  }
  const rows = getEquipmentRows(game.player);
  const idx = game.inventoryCursorByTab.equipment || 0;
  const row = rows[idx] || null;
  if (!row) return { item: null, slotLabel: null };
  return { item: row.item || null, slotLabel: formatSlotName(row.slot) };
}

export function getItemInspectLines(game, item, slotLabel = null) {
  if (!item) {
    return slotLabel ? [`Slot: ${slotLabel}`, 'No item equipped.'] : ['No item selected.'];
  }

  const lines = [
    item.name,
    `Type: ${item.type}`,
  ];
  if (item.rarity) lines.push(`Rarity: ${String(item.rarity).toUpperCase()}`);
  if (item.slot) lines.push(`Slot: ${formatSlotName(item.slot)}`);

  const bonuses = Object.entries(item.statBonuses || {})
    .filter(([, value]) => value !== 0)
    .sort(([a], [b]) => a.localeCompare(b));
  if (bonuses.length > 0) {
    lines.push('Bonuses:');
    for (const [stat, value] of bonuses) {
      const sign = value > 0 ? '+' : '';
      lines.push(`${sign}${value} ${stat}`);
    }
  }

  if (item.skill) {
    lines.push(`Skill: ${item.skill.name}`);
    lines.push(`CD: ${item.skill.cooldown}  Dmg: ${item.skill.damage}`);
    if (item.skill.description) {
      lines.push(...wrapTextLines(item.skill.description, 30));
    }
    if (game.player) {
      const bindings = game.player.skillSlotBindings || [null, null, null];
      const slotLabels = ['Q', 'E', 'R'];
      let boundLabel = null;
      for (const [eqSlot, equipped] of Object.entries(game.player.equipment)) {
        if (equipped === item) {
          const bIdx = bindings.indexOf(eqSlot);
          if (bIdx !== -1) boundLabel = slotLabels[bIdx];
          break;
        }
      }
      lines.push(boundLabel ? `Bound to: ${boundLabel}` : 'Q/E/R to assign slot');
    }
  }

  if (item.effect) {
    lines.push(`Effect: ${item.effect.replaceAll('_', ' ')}`);
  }

  if (item.description) {
    lines.push(...wrapTextLines(item.description, 30));
  }

  const compareLines = getItemComparisonLines(game, item);
  if (compareLines.length > 0) {
    lines.push('');
    lines.push(...compareLines);
  }

  return lines;
}

export function getItemComparisonLines(game, item) {
  if (!game.player || !item || !item.slot) return [];

  const equipped = game.player.equipment[item.slot] || null;
  const slotName = formatSlotName(item.slot);

  if (!equipped) {
    return [`Compare (${slotName}): slot empty`];
  }

  const lines = [`Compare (${slotName}): ${equipped.name}`];
  const candidateBonuses = item.statBonuses || {};
  const equippedBonuses = equipped.statBonuses || {};
  const statSet = new Set([
    ...Object.keys(candidateBonuses),
    ...Object.keys(equippedBonuses),
  ]);

  if (statSet.size === 0) {
    lines.push('Stats: no bonus changes');
  } else {
    const sortedStats = Array.from(statSet).sort((a, b) => a.localeCompare(b));
    for (const stat of sortedStats) {
      const nextValue = candidateBonuses[stat] || 0;
      const currentValue = equippedBonuses[stat] || 0;
      const delta = nextValue - currentValue;
      const deltaPrefix = delta > 0 ? '+' : '';
      const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
      lines.push(`${stat}: ${deltaPrefix}${delta} (${direction})`);
    }
  }

  const rarityOrder = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
  const candidateRank = rarityOrder[item.rarity] ?? -1;
  const equippedRank = rarityOrder[equipped.rarity] ?? -1;
  if (candidateRank >= 0 && equippedRank >= 0) {
    const rarityDelta = candidateRank - equippedRank;
    if (rarityDelta > 0) {
      lines.push(`Rarity: +${rarityDelta} tier`);
    } else if (rarityDelta < 0) {
      lines.push(`Rarity: ${rarityDelta} tier`);
    } else {
      lines.push('Rarity: same tier');
    }
  }

  const nextSkill = item.skill?.name || null;
  const currentSkill = equipped.skill?.name || null;
  if (nextSkill && !currentSkill) {
    lines.push(`Skill: gain ${nextSkill}`);
  } else if (!nextSkill && currentSkill) {
    lines.push(`Skill: lose ${currentSkill}`);
  } else if (nextSkill && currentSkill && nextSkill !== currentSkill) {
    lines.push(`Skill: ${currentSkill} -> ${nextSkill}`);
  } else if (nextSkill && currentSkill && nextSkill === currentSkill) {
    lines.push(`Skill: keep ${nextSkill}`);
  }

  return lines;
}

export function getStashItemSummaryLines(game, item) {
  if (!item) return [];
  const lines = [];
  const rarityStr = item.rarity ? ` (${String(item.rarity).toUpperCase()})` : '';
  lines.push(`${item.name}${rarityStr}  -  ${item.type || 'item'}`);
  const bonuses = Object.entries(item.statBonuses || {}).filter(([, v]) => v !== 0);
  if (bonuses.length > 0) {
    lines.push(bonuses.map(([s, v]) => `${v > 0 ? '+' : ''}${v} ${s}`).join('  '));
  }
  if (item.skill) {
    lines.push(`Skill: ${item.skill.name}  CD:${item.skill.cooldown}  Dmg:${item.skill.damage}`);
  }
  if (item.effect) {
    lines.push(`Effect: ${item.effect.replaceAll('_', ' ')}`);
  }
  return lines;
}

export function drawCombatVfx(game, nowMs) {
  const ctx = game.ctx;
  const cam = game.camera;

  for (const vfx of game.combatVfx.projectiles) {
    const t = Math.max(0, Math.min(1, (nowMs - vfx.startMs) / vfx.durationMs));
    const px = vfx.fromX + (vfx.toX - vfx.fromX) * t;
    const py = vfx.fromY + (vfx.toY - vfx.fromY) * t;
    const sprite = game.sprites.get(vfx.spriteKey);
    const size = Math.max(6, Math.floor(cam.tileSize * 0.5));
    const { sx, sy } = cam.tileToScreen(px, py);
    const drawX = sx + Math.floor(cam.tileSize / 2) - Math.floor(size / 2);
    const drawY = sy + Math.floor(cam.tileSize / 2) - Math.floor(size / 2);
    if (sprite) {
      ctx.drawImage(sprite, drawX, drawY, size, size);
    } else {
      ctx.fillStyle = '#ffd47a';
      ctx.fillRect(drawX, drawY, size, size);
    }
  }

  const savedAlign = ctx.textAlign;
  const savedBaseline = ctx.textBaseline;
  const savedAlpha = ctx.globalAlpha;
  const fontSize = Math.max(10, Math.floor(cam.tileSize * 0.45));
  ctx.font = `${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const vfx of game.combatVfx.floatingTexts) {
    const t = Math.max(0, Math.min(1, (nowMs - vfx.startMs) / vfx.durationMs));
    const alpha = 1 - t;
    const rise = t * cam.tileSize * 0.9;
    const { sx, sy } = cam.tileToScreen(vfx.tileX, vfx.tileY);
    const textX = sx + cam.tileSize / 2;
    const textY = sy + cam.tileSize * 0.2 - rise;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#000000';
    ctx.fillText(vfx.text, textX + 1, textY + 1);
    ctx.fillStyle = vfx.color;
    ctx.fillText(vfx.text, textX, textY);
  }

  ctx.globalAlpha = savedAlpha;
  ctx.textAlign = savedAlign;
  ctx.textBaseline = savedBaseline;
}

export function drawInventoryOverlay(game) {
  const ctx = game.ctx;
  const uiScale = Math.max(1, Math.min(1.6, Math.min(game.canvas.width, game.canvas.height) / 900));
  const panelW = Math.min(Math.round(860 * uiScale), game.canvas.width - 40);
  const panelH = Math.min(Math.round(520 * uiScale), game.canvas.height - 40);
  const x = Math.floor((game.canvas.width - panelW) / 2);
  const y = Math.floor((game.canvas.height - panelH) / 2);
  const listW = Math.round(panelW * 0.54);
  const detailX = x + listW + Math.round(14 * uiScale);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);

  ctx.fillStyle = '#171a1f';
  ctx.fillRect(x, y, panelW, panelH);
  ctx.strokeStyle = '#5a6572';
  ctx.strokeRect(x, y, panelW, panelH);

  // Vertical divider between left column and inspect panel
  ctx.strokeStyle = '#333a42';
  ctx.beginPath();
  ctx.moveTo(x + listW, y + Math.round(40 * uiScale));
  ctx.lineTo(x + listW, y + panelH - Math.round(56 * uiScale));
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = `${Math.round(16 * uiScale)}px monospace`;
  ctx.fillText('Inventory', x + Math.round(16 * uiScale), y + Math.round(26 * uiScale));

  // --- Equipment section ---
  const eqLabel = 'Equipment:';
  const eqStartY = y + Math.round(50 * uiScale);
  ctx.fillStyle = '#a8b4c1';
  ctx.font = `${Math.round(11 * uiScale)}px monospace`;
  ctx.fillText(eqLabel, x + Math.round(20 * uiScale), eqStartY);

  const eqRows = getEquipmentRows(game.player);
  const eqCursor = game.inventoryCursorByTab.equipment || 0;
  const eqLineH = Math.round(19 * uiScale);
  const eqItemStartY = eqStartY + Math.round(16 * uiScale);

  ctx.font = `${Math.round(13 * uiScale)}px monospace`;
  for (let i = 0; i < eqRows.length; i++) {
    const rowY = eqItemStartY + i * eqLineH;
    const selected = game.inventorySection === 'equipment' && i === eqCursor;
    if (selected) {
      ctx.fillStyle = '#2a313a';
      ctx.fillRect(x + Math.round(14 * uiScale), rowY - Math.round(13 * uiScale), listW - Math.round(20 * uiScale), Math.round(17 * uiScale));
    }

    const row = eqRows[i];
    const baseX = x + Math.round(20 * uiScale);
    const label = `${formatSlotName(row.slot)}: `;
    ctx.fillStyle = selected ? '#ffffff' : '#c3cbd4';
    ctx.fillText(label, baseX, rowY);
    const itemX = baseX + ctx.measureText(label).width;
    if (row.item) {
      ctx.fillStyle = getRarityColor(row.item.rarity, selected ? '#ffffff' : '#c3cbd4');
      ctx.fillText(truncateLabel(row.item.name, 18), itemX, rowY);
      if (row.item.skill) {
        const bindings = game.player.skillSlotBindings || [null, null, null];
        const slotLabels = ['Q', 'E', 'R'];
        for (let si = 0; si < 3; si++) {
          if (bindings[si] === row.slot) {
            const nameEndX = itemX + ctx.measureText(truncateLabel(row.item.name, 18)).width + Math.round(6 * uiScale);
            ctx.fillStyle = '#6bc4ff';
            ctx.fillText(`[${slotLabels[si]}]`, nameEndX, rowY);
            break;
          }
        }
      }
    } else {
      ctx.fillStyle = '#7d8894';
      ctx.fillText('(empty)', itemX, rowY);
    }
  }

  // --- Divider between equipment and items ---
  const dividerY = eqItemStartY + eqRows.length * eqLineH + Math.round(4 * uiScale);
  ctx.strokeStyle = '#333a42';
  ctx.beginPath();
  ctx.moveTo(x + Math.round(14 * uiScale), dividerY);
  ctx.lineTo(x + listW - Math.round(14 * uiScale), dividerY);
  ctx.stroke();

  // --- Items section ---
  const itemsLabelY = dividerY + Math.round(16 * uiScale);
  ctx.fillStyle = '#a8b4c1';
  ctx.font = `${Math.round(11 * uiScale)}px monospace`;
  ctx.fillText('Items:', x + Math.round(20 * uiScale), itemsLabelY);

  const capacity = getInventoryCapacity();
  const cols = getInventoryGridColumns();
  const gridRows = Math.ceil(capacity / cols);
  const invCursor = game.inventoryCursorByTab.inventory || 0;
  const gridX = x + Math.round(20 * uiScale);
  const gridY = itemsLabelY + Math.round(12 * uiScale);
  const gridW = listW - Math.round(32 * uiScale);
  const availH = y + panelH - Math.round(56 * uiScale) - gridY;
  const gap = Math.max(4, Math.round(6 * uiScale));
  const cellW = Math.floor((gridW - gap * (cols - 1)) / cols);
  const cellH = Math.floor((availH - gap * (gridRows - 1)) / gridRows);
  const cellSize = Math.max(22, Math.min(cellW, cellH, Math.round(72 * uiScale)));
  const iconSize = Math.max(12, Math.floor(cellSize * 0.42));

  for (let slotIndex = 0; slotIndex < capacity; slotIndex++) {
    const col = slotIndex % cols;
    const row = Math.floor(slotIndex / cols);
    const cellX = gridX + col * (cellSize + gap);
    const cellY = gridY + row * (cellSize + gap);
    const item = game.player.inventory[slotIndex] || null;
    const selected = game.inventorySection === 'items' && slotIndex === invCursor;

    ctx.fillStyle = '#1d242d';
    ctx.fillRect(cellX, cellY, cellSize, cellSize);
    ctx.strokeStyle = selected ? '#f4f7fa' : '#495664';
    ctx.lineWidth = selected ? Math.max(2, Math.floor(uiScale * 2)) : 1;
    ctx.strokeRect(cellX, cellY, cellSize, cellSize);

    if (item) {
      const rarityColor = getRarityColor(item.rarity, '#768493');
      const savedAlpha = ctx.globalAlpha;
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = rarityColor;
      ctx.fillRect(cellX + 1, cellY + 1, cellSize - 2, cellSize - 2);
      ctx.globalAlpha = savedAlpha;

      const iconX = cellX + Math.floor((cellSize - iconSize) / 2);
      const iconY = cellY + Math.round(6 * uiScale);
      drawInventoryItemIcon(game, ctx, item, iconX, iconY, iconSize);

      ctx.fillStyle = selected ? '#ffffff' : getRarityColor(item.rarity, '#c3cbd4');
      ctx.font = `${Math.max(8, Math.round(9 * uiScale))}px monospace`;
      const label = truncateLabel(item.name, 12);
      ctx.fillText(label, cellX + Math.round(4 * uiScale), cellY + cellSize - Math.round(6 * uiScale));
    } else {
      ctx.fillStyle = '#6f7b89';
      ctx.font = `${Math.max(8, Math.round(9 * uiScale))}px monospace`;
      ctx.fillText('(empty)', cellX + Math.round(4 * uiScale), cellY + cellSize - Math.round(6 * uiScale));
    }
  }

  // Reset lineWidth
  ctx.lineWidth = 1;

  // --- Inspect panel (right side) ---
  const inspectTarget = getSelectedInspectTarget(game);
  const details = getItemInspectLines(game, inspectTarget.item, inspectTarget.slotLabel);
  ctx.fillStyle = '#d6dbe2';
  ctx.font = `${Math.round(13 * uiScale)}px monospace`;
  ctx.fillText('Inspect', detailX, y + Math.round(50 * uiScale));
  ctx.font = `${Math.round(12 * uiScale)}px monospace`;
  const detailLineH = Math.round(16 * uiScale);
  const maxDetailRows = Math.max(1, Math.floor((panelH - Math.round(130 * uiScale)) / detailLineH));
  for (let i = 0; i < Math.min(details.length, maxDetailRows); i++) {
    const line = details[i];
    const isTitle = i === 0;
    if (isTitle && inspectTarget.item) {
      ctx.fillStyle = getRarityColor(inspectTarget.item.rarity, '#ffffff');
    } else {
      ctx.fillStyle = isTitle ? '#ffffff' : '#b8c0ca';
    }
    ctx.fillText(line, detailX, y + Math.round(72 * uiScale) + i * detailLineH);
  }

  // --- Control hints ---
  ctx.fillStyle = '#94a0ad';
  ctx.font = `${Math.round(11 * uiScale)}px monospace`;
  ctx.fillText(
    'Arrows: navigate  Z/Enter: equip/unequip  X: drop  U: unequip',
    x + Math.round(16 * uiScale),
    y + panelH - Math.round(36 * uiScale)
  );
  ctx.fillText(
    '1/2/3: belt  Q/E/R: skill slot  C: auto belt  Tab/I/ESC: close',
    x + Math.round(16 * uiScale),
    y + panelH - Math.round(18 * uiScale)
  );
}

export function drawStatsOverlay(game) {
  if (!game.player) return;
  const ctx = game.ctx;
  const uiScale = Math.max(1, Math.min(1.5, Math.min(game.canvas.width, game.canvas.height) / 900));
  const panelW = Math.min(Math.round(520 * uiScale), game.canvas.width - 40);
  const panelH = Math.min(Math.round(420 * uiScale), game.canvas.height - 40);
  const x = Math.floor((game.canvas.width - panelW) / 2);
  const y = Math.floor((game.canvas.height - panelH) / 2);

  const totalStats = getEntityStatsWithEquipment(game.player);
  const equippedBonuses = getEquippedStats(game.player);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.74)';
  ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);

  ctx.fillStyle = '#15191f';
  ctx.fillRect(x, y, panelW, panelH);
  ctx.strokeStyle = '#5a6572';
  ctx.strokeRect(x, y, panelW, panelH);

  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(16 * uiScale)}px monospace`;
  ctx.fillText('Character Stats', x + Math.round(16 * uiScale), y + Math.round(28 * uiScale));

  ctx.font = `${Math.round(13 * uiScale)}px monospace`;
  ctx.fillStyle = '#cad4de';
  ctx.fillText(`Class: ${getClassLabel(game.player.playerClass)}`, x + Math.round(16 * uiScale), y + Math.round(58 * uiScale));
  ctx.fillText(`HP: ${game.player.hp}/${game.player.maxHp}`, x + Math.round(16 * uiScale), y + Math.round(78 * uiScale));
  ctx.fillText(`Floor: ${game.floorNumber}`, x + Math.round(180 * uiScale), y + Math.round(58 * uiScale));
  ctx.fillText(`Essence: ${game.player.gold}`, x + Math.round(180 * uiScale), y + Math.round(78 * uiScale));
  ctx.fillText(`Natural Regen: 1 HP every ${getNaturalRegenInterval(game.player)} turns`, x + Math.round(16 * uiScale), y + Math.round(98 * uiScale));

  const classDef = PLAYER_CLASSES[game.player.playerClass];
  const affinitySet = classDef ? classDef.affinityStats : [];
  ctx.fillStyle = '#6bb8e8';
  ctx.fillText(`Affinity: ${affinitySet.join(', ')} (full scaling)`, x + Math.round(16 * uiScale), y + Math.round(118 * uiScale));

  const statStartY = y + Math.round(140 * uiScale);
  const rowH = Math.round(20 * uiScale);
  for (let i = 0; i < STAT_NAMES.length; i++) {
    const stat = STAT_NAMES[i];
    const total = totalStats[stat] || 0;
    const base = game.player.stats[stat] || 0;
    const bonus = equippedBonuses[stat] || 0;
    const isAffinity = affinitySet.includes(stat);
    const bonusText = bonus === 0 ? '' : ` (${bonus > 0 ? '+' : ''}${bonus} gear)`;
    ctx.fillStyle = isAffinity ? '#a3d9ff' : '#b8c3ce';
    ctx.fillText(`${stat}: ${total}${bonusText}`, x + Math.round(16 * uiScale), statStartY + i * rowH);
    ctx.fillStyle = '#6f7d8a';
    ctx.fillText(`Base ${base}`, x + Math.round(190 * uiScale), statStartY + i * rowH);
    ctx.fillStyle = '#555f6a';
    ctx.fillText(STAT_DESCRIPTIONS[stat] || '', x + Math.round(260 * uiScale), statStartY + i * rowH);
  }

  const skillStartY = statStartY + STAT_NAMES.length * rowH + Math.round(14 * uiScale);
  ctx.fillStyle = '#d8e3ee';
  ctx.fillText('Active Skills:', x + Math.round(16 * uiScale), skillStartY);
  const skills = game.player.activeSkills || [];
  const slotLabels = ['Q', 'E', 'R'];
  let drawnCount = 0;
  for (let i = 0; i < Math.min(3, skills.length); i++) {
    const skill = skills[i];
    if (!skill) continue;
    ctx.fillStyle = '#9ab3c9';
    ctx.fillText(`${slotLabels[i]}. ${skill.name} (CD ${skill.currentCooldown}/${skill.cooldown})`, x + Math.round(28 * uiScale), skillStartY + Math.round((drawnCount + 1) * 18 * uiScale));
    drawnCount++;
  }
  if (drawnCount === 0) {
    ctx.fillStyle = '#7d8894';
    ctx.fillText('No skills equipped via gear.', x + Math.round(28 * uiScale), skillStartY + Math.round(18 * uiScale));
  }

  ctx.fillStyle = '#94a0ad';
  ctx.font = `${Math.round(12 * uiScale)}px monospace`;
  ctx.fillText('P or ESC: close', x + Math.round(16 * uiScale), y + panelH - Math.round(18 * uiScale));
}

export function drawMapOverlay(game) {
  if (!game.map || !game.player) return;
  const ctx = game.ctx;
  const map = game.map;
  const cw = game.canvas.width;
  const ch = game.canvas.height;

  // Dim background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
  ctx.fillRect(0, 0, cw, ch);

  // Compute pixel size per tile to fit map in the available space
  const pad = 40;
  const maxW = cw - pad * 2;
  const maxH = ch - pad * 2 - 30; // room for title + hint
  const tilePixel = Math.max(1, Math.min(Math.floor(maxW / map.width), Math.floor(maxH / map.height)));
  const mapPixelW = map.width * tilePixel;
  const mapPixelH = map.height * tilePixel;
  const ox = Math.floor((cw - mapPixelW) / 2);
  const oy = Math.floor((ch - mapPixelH) / 2) + 10;

  // Title
  const uiScale = Math.max(1, Math.min(1.5, Math.min(cw, ch) / 900));
  ctx.fillStyle = '#ffffff';
  ctx.font = `${Math.round(14 * uiScale)}px monospace`;
  ctx.fillText('Dungeon Map', ox, oy - 8);

  // Draw tiles
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const px = ox + tx * tilePixel;
      const py = oy + ty * tilePixel;

      if (!map.isExplored(tx, ty)) {
        // Unexplored = dark
        continue;
      }

      const tile = map.getTile(tx, ty);
      const visible = map.isVisible(tx, ty);

      // Color based on tile type
      switch (tile) {
        case TILE.WALL:       ctx.fillStyle = visible ? '#555568' : '#2a2a36'; break;
        case TILE.FLOOR:      ctx.fillStyle = visible ? '#6a7a6a' : '#3a4a3a'; break;
        case TILE.CORRIDOR:   ctx.fillStyle = visible ? '#5a6a60' : '#333d38'; break;
        case TILE.DOOR:       ctx.fillStyle = visible ? '#aa8030' : '#6a5020'; break;
        case TILE.DOOR_OPEN:  ctx.fillStyle = visible ? '#7a6830' : '#4a4020'; break;
        case TILE.STAIRS_DOWN:ctx.fillStyle = visible ? '#eeeebb' : '#8a8a60'; break;
        case TILE.WATER:      ctx.fillStyle = visible ? '#3060aa' : '#1a3060'; break;
        case TILE.TRAP:       ctx.fillStyle = visible ? '#aa4040' : '#603030'; break;
        default:              ctx.fillStyle = visible ? '#444' : '#222'; break;
      }
      ctx.fillRect(px, py, tilePixel, tilePixel);
    }
  }

  // Draw entities (enemies) in explored+visible tiles
  for (const entity of map.entities) {
    if (entity.type !== 'enemy' || !entity.isAlive()) continue;
    if (!map.isVisible(entity.position.x, entity.position.y)) continue;
    const px = ox + entity.position.x * tilePixel;
    const py = oy + entity.position.y * tilePixel;
    ctx.fillStyle = entity.isBoss ? '#ff3030' : '#ff6060';
    ctx.fillRect(px, py, tilePixel, tilePixel);
  }

  // Draw ground items in visible tiles
  for (const item of map.items) {
    if (!map.isVisible(item.position.x, item.position.y)) continue;
    const px = ox + item.position.x * tilePixel;
    const py = oy + item.position.y * tilePixel;
    ctx.fillStyle = '#ffdd44';
    ctx.fillRect(px, py, tilePixel, tilePixel);
  }

  // Draw player
  const ppx = ox + game.player.position.x * tilePixel;
  const ppy = oy + game.player.position.y * tilePixel;
  ctx.fillStyle = '#44ff44';
  ctx.fillRect(ppx, ppy, tilePixel, tilePixel);

  // Hint
  ctx.fillStyle = '#7f8a94';
  ctx.font = `${Math.round(11 * uiScale)}px monospace`;
  ctx.fillText('M or ESC: close', ox, oy + mapPixelH + Math.round(16 * uiScale));
}

export function drawStartMenu(game) {
  const ctx = game.ctx;
  const w = game.canvas.width;
  const h = game.canvas.height;
  const uiScale = Math.max(1, Math.min(1.6, Math.min(w, h) / 900));
  const classKey = game.selectedClass;
  const classDef = PLAYER_CLASSES[classKey];

  ctx.fillStyle = '#090c12';
  ctx.fillRect(0, 0, w, h);

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(28, 36, 52, 0.65)');
  gradient.addColorStop(1, 'rgba(5, 8, 12, 0.75)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const panelW = Math.min(Math.round(720 * uiScale), w - 50);
  const panelH = Math.min(Math.round(460 * uiScale), h - 50);
  const x = Math.floor((w - panelW) / 2);
  const y = Math.floor((h - panelH) / 2);

  ctx.fillStyle = 'rgba(16, 20, 29, 0.85)';
  ctx.fillRect(x, y, panelW, panelH);
  ctx.strokeStyle = '#4e5d73';
  ctx.strokeRect(x, y, panelW, panelH);

  ctx.fillStyle = '#f2f5f8';
  ctx.font = `${Math.round(46 * uiScale)}px monospace`;
  ctx.fillText('DIEGEIST', x + Math.round(26 * uiScale), y + Math.round(72 * uiScale));

  ctx.fillStyle = '#8ca2b8';
  ctx.font = `${Math.round(14 * uiScale)}px monospace`;
  ctx.fillText('Select class with arrows, then press Enter to begin.', x + Math.round(26 * uiScale), y + Math.round(98 * uiScale));

  const hasSave = hasSavedRun();
  const baseY = y + Math.round(146 * uiScale);
  const rowH = Math.round(32 * uiScale);
  let rowIndex = 0;

  // Continue Run option (if saved run exists)
  if (hasSave) {
    const selected = game.startMenuIndex === 0;
    if (selected) {
      ctx.fillStyle = '#2a3648';
      ctx.fillRect(x + Math.round(24 * uiScale), baseY - Math.round(19 * uiScale), Math.round(250 * uiScale), Math.round(24 * uiScale));
    }
    ctx.fillStyle = selected ? '#a3d9ff' : '#6bb8e8';
    ctx.font = `${Math.round(18 * uiScale)}px monospace`;
    ctx.fillText('Continue Run', x + Math.round(34 * uiScale), baseY);
    rowIndex = 1;
  }

  for (let i = 0; i < game.classOrder.length; i++) {
    const key = game.classOrder[i];
    const menuIdx = i + rowIndex;
    const selected = menuIdx === game.startMenuIndex;
    if (selected) {
      ctx.fillStyle = '#2a3648';
      ctx.fillRect(x + Math.round(24 * uiScale), baseY - Math.round(19 * uiScale) + menuIdx * rowH, Math.round(250 * uiScale), Math.round(24 * uiScale));
    }
    ctx.fillStyle = selected ? '#ffffff' : '#9aa9b8';
    ctx.font = `${Math.round(18 * uiScale)}px monospace`;
    ctx.fillText(getClassLabel(key), x + Math.round(34 * uiScale), baseY + menuIdx * rowH);
  }

  const statX = x + Math.round(320 * uiScale);
  const statY = y + Math.round(132 * uiScale);
  ctx.fillStyle = '#d4dfeb';
  ctx.font = `${Math.round(16 * uiScale)}px monospace`;
  ctx.fillText(`${classDef.name}`, statX, statY);
  ctx.fillStyle = '#8ca2b8';
  ctx.font = `${Math.round(12 * uiScale)}px monospace`;
  ctx.fillText(classDef.description || '', statX, statY + Math.round(18 * uiScale));
  ctx.fillStyle = '#6bb8e8';
  ctx.fillText(`Affinity: ${classDef.affinity || ''}`, statX, statY + Math.round(34 * uiScale));

  ctx.font = `${Math.round(12 * uiScale)}px monospace`;
  const statStartY = statY + Math.round(56 * uiScale);
  for (let i = 0; i < STAT_NAMES.length; i++) {
    const stat = STAT_NAMES[i];
    const isAffinity = classDef.affinityStats.includes(stat);
    const rowY = statStartY + i * Math.round(17 * uiScale);
    ctx.fillStyle = isAffinity ? '#a3d9ff' : '#aab8c7';
    ctx.fillText(`${stat}: ${classDef.baseStats[stat]}`, statX, rowY);
    ctx.fillStyle = '#6a7a8a';
    ctx.fillText(STAT_DESCRIPTIONS[stat] || '', statX + Math.round(60 * uiScale), rowY);
  }
  ctx.fillStyle = '#aab8c7';
  ctx.fillText(`HP: ${classDef.baseHp}`, statX, statStartY + STAT_NAMES.length * Math.round(17 * uiScale));

  const essence = game.saveData?.currency || 0;
  ctx.fillStyle = '#d9e5f2';
  ctx.font = `${Math.round(14 * uiScale)}px monospace`;
  ctx.fillText(`Stored Essence: ${essence}`, x + Math.round(26 * uiScale), y + panelH - Math.round(46 * uiScale));
  ctx.fillStyle = '#7f94ab';
  ctx.fillText('Enter/Z: Start Run', x + Math.round(26 * uiScale), y + panelH - Math.round(22 * uiScale));
  ctx.fillText('H: Hub Menu', x + Math.round(210 * uiScale), y + panelH - Math.round(22 * uiScale));
}

export function drawDeathSplash(game) {
  const ctx = game.ctx;
  const w = game.canvas.width;
  const h = game.canvas.height;
  const uiScale = Math.max(1, Math.min(1.6, Math.min(w, h) / 900));

  ctx.fillStyle = 'rgba(75, 10, 10, 0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#ff5a5a';
  ctx.font = `${Math.round(58 * uiScale)}px monospace`;
  ctx.fillText('YOU DIED', Math.round(w * 0.5 - 160 * uiScale), Math.round(h * 0.45));

  ctx.fillStyle = '#d3d9df';
  ctx.font = `${Math.round(15 * uiScale)}px monospace`;
  const cause = game.runSummary?.causeOfDeath || 'Unknown';
  ctx.fillText(`Killed by: ${cause}`, Math.round(w * 0.5 - 100 * uiScale), Math.round(h * 0.45) + Math.round(40 * uiScale));
  if (game.deathSplashFrames >= 25) {
    ctx.fillStyle = '#f2f6fb';
    ctx.fillText('Press Enter to continue', Math.round(w * 0.5 - 120 * uiScale), Math.round(h * 0.45) + Math.round(78 * uiScale));
  }
}

export function drawDeathSaveChoice(game) {
  const ctx = game.ctx;
  const w = game.canvas.width;
  const h = game.canvas.height;
  const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));
  const panelW = Math.min(Math.round(440 * uiScale), w - 40);
  const panelH = Math.min(Math.round(230 * uiScale), h - 40);
  const x = Math.floor((w - panelW) / 2);
  const y = Math.floor((h - panelH) / 2);

  ctx.fillStyle = '#0b0f16';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#171d28';
  ctx.fillRect(x, y, panelW, panelH);
  ctx.strokeStyle = '#4f6075';
  ctx.strokeRect(x, y, panelW, panelH);

  ctx.fillStyle = '#e8eef5';
  ctx.font = `${Math.round(22 * uiScale)}px monospace`;
  ctx.fillText('Death Save', x + Math.round(20 * uiScale), y + Math.round(38 * uiScale));

  ctx.fillStyle = '#7a8a9a';
  ctx.font = `${Math.round(11 * uiScale)}px monospace`;
  ctx.fillText('Without a save, items are lost and materials are halved.', x + Math.round(20 * uiScale), y + Math.round(56 * uiScale));

  ctx.fillStyle = '#afc0d2';
  ctx.font = `${Math.round(13 * uiScale)}px monospace`;
  ctx.fillText('Choose one to keep:', x + Math.round(20 * uiScale), y + Math.round(76 * uiScale));

  const options = ['Keep 1 item (lose all materials)', 'Keep all materials (lose all items)'];
  for (let i = 0; i < options.length; i++) {
    const selected = i === game.deathSaveIndex;
    if (selected) {
      ctx.fillStyle = '#2b3a4d';
      ctx.fillRect(x + Math.round(18 * uiScale), y + Math.round(96 * uiScale) + i * Math.round(36 * uiScale), panelW - Math.round(36 * uiScale), Math.round(28 * uiScale));
    }
    ctx.fillStyle = selected ? '#ffffff' : '#9db0c4';
    ctx.font = `${Math.round(14 * uiScale)}px monospace`;
    ctx.fillText(options[i], x + Math.round(28 * uiScale), y + Math.round(116 * uiScale) + i * Math.round(36 * uiScale));
  }
}

export function drawPostDeathMenu(game) {
  const ctx = game.ctx;
  const w = game.canvas.width;
  const h = game.canvas.height;
  const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));
  const panelW = Math.min(Math.round(520 * uiScale), w - 40);
  const panelH = Math.min(Math.round(360 * uiScale), h - 40);
  const x = Math.floor((w - panelW) / 2);
  const y = Math.floor((h - panelH) / 2);

  ctx.fillStyle = '#0b0f16';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#171d28';
  ctx.fillRect(x, y, panelW, panelH);
  ctx.strokeStyle = '#4f6075';
  ctx.strokeRect(x, y, panelW, panelH);

  ctx.fillStyle = '#e8eef5';
  ctx.font = `${Math.round(28 * uiScale)}px monospace`;
  ctx.fillText('Run Summary', x + Math.round(20 * uiScale), y + Math.round(44 * uiScale));

  ctx.fillStyle = '#afc0d2';
  ctx.font = `${Math.round(14 * uiScale)}px monospace`;
  ctx.fillText(`Class: ${getClassLabel(game.runSummary?.classKey || game.selectedClass)}`, x + Math.round(20 * uiScale), y + Math.round(78 * uiScale));
  ctx.fillText(`Floors Reached: ${game.runSummary?.floorsReached || 1}`, x + Math.round(20 * uiScale), y + Math.round(100 * uiScale));
  ctx.fillText(`Enemies Killed: ${game.runSummary?.enemiesKilled || 0}`, x + Math.round(20 * uiScale), y + Math.round(122 * uiScale));
  ctx.fillText(`Essence Earned: ${game.runSummary?.currencyEarned || 0}`, x + Math.round(20 * uiScale), y + Math.round(144 * uiScale));

  // Material summary
  let matOffset = 0;
  if (game.rawRunMaterials) {
    const matNames = { timber: 'Timber', stone: 'Stone', iron: 'Iron', crystal: 'Crystal', aether: 'Aether' };
    let matLine = 'Materials: ';
    let hasMats = false;
    for (const [key, label] of Object.entries(matNames)) {
      const raw = game.rawRunMaterials[key] || 0;
      if (raw > 0) {
        const kept = game.committedMaterials?.[key] || 0;
        matLine += `${label}:${kept}/${raw} `;
        hasMats = true;
      }
    }
    if (hasMats) {
      ctx.fillText(matLine.trim(), x + Math.round(20 * uiScale), y + Math.round(166 * uiScale));
      ctx.fillStyle = '#ff8a6a';
      ctx.fillText('(50% kept on death)', x + Math.round(20 * uiScale), y + Math.round(184 * uiScale));
      ctx.fillStyle = '#afc0d2';
      matOffset = Math.round(48 * uiScale);
    }
  }

  const options = ['Retry', 'Hub', 'Main Menu'];
  for (let i = 0; i < options.length; i++) {
    const selected = i === game.postDeathMenuIndex;
    if (selected) {
      ctx.fillStyle = '#2b3a4d';
      ctx.fillRect(x + Math.round(18 * uiScale), y + Math.round(186 * uiScale) + matOffset + i * Math.round(36 * uiScale), Math.round(170 * uiScale), Math.round(26 * uiScale));
    }
    ctx.fillStyle = selected ? '#ffffff' : '#9db0c4';
    ctx.font = `${Math.round(18 * uiScale)}px monospace`;
    ctx.fillText(options[i], x + Math.round(28 * uiScale), y + Math.round(206 * uiScale) + matOffset + i * Math.round(36 * uiScale));
  }

  ctx.fillStyle = '#7d8e9f';
  ctx.font = `${Math.round(12 * uiScale)}px monospace`;
  ctx.fillText('Up/Down: Select  Enter/Z: Confirm', x + Math.round(20 * uiScale), y + panelH - Math.round(20 * uiScale));
}

export function drawVictoryScreen(game) {
  const ctx = game.ctx;
  const w = game.canvas.width;
  const h = game.canvas.height;
  const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));
  const panelW = Math.min(Math.round(620 * uiScale), w - 40);
  const panelH = Math.min(Math.round(360 * uiScale), h - 40);
  const x = Math.floor((w - panelW) / 2);
  const y = Math.floor((h - panelH) / 2);

  ctx.fillStyle = '#07110b';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(27, 69, 45, 0.35)';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#13251b';
  ctx.fillRect(x, y, panelW, panelH);
  ctx.strokeStyle = '#6baf7f';
  ctx.strokeRect(x, y, panelW, panelH);

  ctx.fillStyle = '#dbffe3';
  ctx.font = `${Math.round(34 * uiScale)}px monospace`;
  ctx.fillText('VICTORY', x + Math.round(20 * uiScale), y + Math.round(48 * uiScale));

  ctx.fillStyle = '#b7e3c2';
  ctx.font = `${Math.round(14 * uiScale)}px monospace`;
  ctx.fillText('The Void Tyrant is slain. Diegeist is conquered.', x + Math.round(20 * uiScale), y + Math.round(82 * uiScale));
  ctx.fillText(`Class: ${getClassLabel(game.runSummary?.classKey || game.selectedClass)}`, x + Math.round(20 * uiScale), y + Math.round(112 * uiScale));
  ctx.fillText(`Floors Reached: ${game.runSummary?.floorsReached || game.floorNumber}`, x + Math.round(20 * uiScale), y + Math.round(134 * uiScale));
  ctx.fillText(`Enemies Killed: ${game.runSummary?.enemiesKilled || 0}`, x + Math.round(20 * uiScale), y + Math.round(156 * uiScale));
  ctx.fillText(`Essence Earned: ${game.runSummary?.currencyEarned || 0}`, x + Math.round(20 * uiScale), y + Math.round(178 * uiScale));

  // Material summary (100% kept on victory)
  if (game.rawRunMaterials) {
    const matNames = { timber: 'Timber', stone: 'Stone', iron: 'Iron', crystal: 'Crystal', aether: 'Aether' };
    let matLine = 'Materials: ';
    let hasMats = false;
    for (const [key, label] of Object.entries(matNames)) {
      const val = game.rawRunMaterials[key] || 0;
      if (val > 0) {
        matLine += `${label}:${val} `;
        hasMats = true;
      }
    }
    if (hasMats) {
      ctx.fillText(matLine.trim(), x + Math.round(20 * uiScale), y + Math.round(200 * uiScale));
      ctx.fillStyle = '#7ad1a0';
      ctx.fillText('(100% kept on victory)', x + Math.round(20 * uiScale), y + Math.round(218 * uiScale));
      ctx.fillStyle = '#b7e3c2';
    }
  }

  ctx.fillStyle = '#86c99b';
  ctx.font = `${Math.round(12 * uiScale)}px monospace`;
  ctx.fillText('Press Enter to return to main menu', x + Math.round(20 * uiScale), y + panelH - Math.round(20 * uiScale));
  ctx.fillText('Press H to open Hub', x + Math.round(20 * uiScale), y + panelH - Math.round(36 * uiScale));
}

export function drawHubMenu(game) {
  const ctx = game.ctx;
  const w = game.canvas.width;
  const h = game.canvas.height;
  const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));
  const panelW = Math.min(Math.round(740 * uiScale), w - 40);
  const panelH = Math.min(Math.round(430 * uiScale), h - 40);
  const x = Math.floor((w - panelW) / 2);
  const y = Math.floor((h - panelH) / 2);
  const options = getHubMenuOptions();

  ctx.fillStyle = '#0b0f16';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#171d28';
  ctx.fillRect(x, y, panelW, panelH);
  ctx.strokeStyle = '#4f6075';
  ctx.strokeRect(x, y, panelW, panelH);

  ctx.fillStyle = '#e8eef5';
  ctx.font = `${Math.round(32 * uiScale)}px monospace`;
  ctx.fillText('HUB', x + Math.round(20 * uiScale), y + Math.round(46 * uiScale));

  ctx.fillStyle = '#b7c7d8';
  ctx.font = `${Math.round(14 * uiScale)}px monospace`;
  ctx.fillText(`Essence: ${game.saveData?.currency || 0}`, x + Math.round(20 * uiScale), y + Math.round(78 * uiScale));
  const pendingText = game.pendingStashLoadoutItem
    ? `Pending loadout: ${game.pendingStashLoadoutItem.name}`
    : 'Pending loadout: none';
  ctx.fillText(pendingText, x + Math.round(220 * uiScale), y + Math.round(78 * uiScale));

  // Material totals
  const matNames = { timber: 'TMB', stone: 'STN', iron: 'IRN', crystal: 'CRY', aether: 'ATH' };
  const matColors = { timber: '#c4a05a', stone: '#b8b8a8', iron: '#8eaaba', crystal: '#b48ee8', aether: '#d8b4ff' };
  const mats = game.saveData?.materials || {};
  ctx.font = `bold ${Math.round(12 * uiScale)}px monospace`;
  let matX = x + Math.round(20 * uiScale);
  const matY = y + Math.round(98 * uiScale);
  for (const [key, abbr] of Object.entries(matNames)) {
    const label = `${abbr}:${mats[key] || 0}`;
    ctx.fillStyle = '#000000';
    ctx.fillText(label, matX + 1, matY + 1);
    ctx.fillStyle = matColors[key];
    ctx.fillText(label, matX, matY);
    matX += ctx.measureText(label).width + Math.round(12 * uiScale);
  }

  const optionY = y + Math.round(140 * uiScale);
  for (let i = 0; i < options.length; i++) {
    const selected = i === game.hubMenuIndex;
    if (selected) {
      ctx.fillStyle = '#2b3a4d';
      ctx.fillRect(x + Math.round(20 * uiScale), optionY - Math.round(20 * uiScale) + i * Math.round(38 * uiScale), Math.round(280 * uiScale), Math.round(28 * uiScale));
    }
    ctx.fillStyle = selected ? '#ffffff' : '#9db0c4';
    ctx.font = `${Math.round(18 * uiScale)}px monospace`;
    ctx.fillText(options[i], x + Math.round(30 * uiScale), optionY + i * Math.round(38 * uiScale));
  }

  ctx.fillStyle = '#9fb2c5';
  ctx.font = `${Math.round(13 * uiScale)}px monospace`;
  ctx.fillText(`Run stash candidates: ${game.hubRunCarryover.length}`, x + Math.round(340 * uiScale), y + Math.round(134 * uiScale));
  ctx.fillText(`Last run: ${game.runSummary?.causeOfDeath || 'N/A'}`, x + Math.round(340 * uiScale), y + Math.round(156 * uiScale));
  if (game.hubNotice) {
    ctx.fillStyle = '#d9e7f5';
    ctx.fillText(game.hubNotice, x + Math.round(340 * uiScale), y + Math.round(188 * uiScale));
  }

  ctx.fillStyle = '#7d8e9f';
  ctx.font = `${Math.round(12 * uiScale)}px monospace`;
  ctx.fillText('Up/Down: Select  Enter/Z: Confirm  ESC: Back', x + Math.round(20 * uiScale), y + panelH - Math.round(20 * uiScale));
}

export function drawHubShop(game) {
  const ctx = game.ctx;
  const w = game.canvas.width;
  const h = game.canvas.height;
  const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));
  const panelW = Math.min(Math.round(760 * uiScale), w - 40);
  const panelH = Math.min(Math.round(450 * uiScale), h - 40);
  const x = Math.floor((w - panelW) / 2);
  const y = Math.floor((h - panelH) / 2);

  ctx.fillStyle = '#0b0f16';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#171d28';
  ctx.fillRect(x, y, panelW, panelH);
  ctx.strokeStyle = '#4f6075';
  ctx.strokeRect(x, y, panelW, panelH);

  ctx.fillStyle = '#e8eef5';
  ctx.font = `${Math.round(28 * uiScale)}px monospace`;
  ctx.fillText('Hub Shop', x + Math.round(20 * uiScale), y + Math.round(42 * uiScale));
  ctx.fillStyle = '#b7c7d8';
  ctx.font = `${Math.round(14 * uiScale)}px monospace`;
  ctx.fillText(`Essence: ${game.saveData?.currency || 0}`, x + Math.round(20 * uiScale), y + Math.round(68 * uiScale));

  // Material totals
  const matNames = { timber: 'TMB', stone: 'STN', iron: 'IRN', crystal: 'CRY', aether: 'ATH' };
  const matColors = { timber: '#c4a05a', stone: '#b8b8a8', iron: '#8eaaba', crystal: '#b48ee8', aether: '#d8b4ff' };
  const mats = game.saveData?.materials || {};
  ctx.font = `bold ${Math.round(12 * uiScale)}px monospace`;
  let shopMatX = x + Math.round(20 * uiScale);
  const shopMatY = y + Math.round(88 * uiScale);
  for (const [key, abbr] of Object.entries(matNames)) {
    const label = `${abbr}:${mats[key] || 0}`;
    ctx.fillStyle = '#000000';
    ctx.fillText(label, shopMatX + 1, shopMatY + 1);
    ctx.fillStyle = matColors[key];
    ctx.fillText(label, shopMatX, shopMatY);
    shopMatX += ctx.measureText(label).width + Math.round(12 * uiScale);
  }

  const startY = y + Math.round(110 * uiScale);
  const lineH = Math.round(32 * uiScale);
  const shopBottomY = y + panelH - Math.round(56 * uiScale);
  const shopMaxVisible = Math.max(1, Math.floor((shopBottomY - startY) / lineH));
  const shopSv = getScrollView(game.hubShopCursor, game.hubShopScrollOffset, game.hubShop.items.length, shopMaxVisible);
  game.hubShopScrollOffset = shopSv.scrollOffset;

  for (let i = shopSv.startIdx; i < shopSv.endIdx; i++) {
    const row = i - shopSv.startIdx;
    const item = game.hubShop.items[i];
    const selected = i === game.hubShopCursor;
    if (selected) {
      ctx.fillStyle = '#2b3a4d';
      ctx.fillRect(x + Math.round(18 * uiScale), startY - Math.round(18 * uiScale) + row * lineH, panelW - Math.round(36 * uiScale), Math.round(24 * uiScale));
    }
    ctx.fillStyle = selected ? '#ffffff' : '#b8c7d7';
    ctx.font = `${Math.round(15 * uiScale)}px monospace`;
    ctx.fillText(item.name, x + Math.round(28 * uiScale), startY + row * lineH);
    ctx.fillStyle = '#8fa5bb';
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    ctx.fillText(`${item.category}  |  cost ${item.cost}`, x + Math.round(320 * uiScale), startY + row * lineH);
  }
  drawScrollIndicators(ctx, x + Math.round(28 * uiScale),
    startY - Math.round(28 * uiScale), shopBottomY,
    shopSv.showUpArrow, shopSv.showDownArrow, uiScale);
  if (game.hubShop.items.length === 0) {
    ctx.fillStyle = '#94a7bb';
    ctx.fillText('No items available. Return to hub and refresh later.', x + Math.round(24 * uiScale), startY);
  }
  if (game.hubNotice) {
    ctx.fillStyle = '#d9e7f5';
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    ctx.fillText(game.hubNotice, x + Math.round(20 * uiScale), y + panelH - Math.round(48 * uiScale));
  }
  ctx.fillStyle = '#7d8e9f';
  ctx.font = `${Math.round(12 * uiScale)}px monospace`;
  ctx.fillText('Up/Down: Select  Enter/Z: Buy  ESC: Back', x + Math.round(20 * uiScale), y + panelH - Math.round(20 * uiScale));
}

export function drawHubStash(game) {
  const ctx = game.ctx;
  const w = game.canvas.width;
  const h = game.canvas.height;
  const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));
  const panelW = Math.min(Math.round(860 * uiScale), w - 40);
  const panelH = Math.min(Math.round(520 * uiScale), h - 40);
  const x = Math.floor((w - panelW) / 2);
  const y = Math.floor((h - panelH) / 2);
  const paneW = Math.floor((panelW - Math.round(56 * uiScale)) / 2);
  const leftX = x + Math.round(20 * uiScale);
  const rightX = leftX + paneW + Math.round(16 * uiScale);
  const paneTop = y + Math.round(78 * uiScale);
  const paneHeight = panelH - Math.round(190 * uiScale);
  const startY = paneTop + Math.round(38 * uiScale);
  const lineH = Math.round(24 * uiScale);
  const maxVisible = Math.max(1, Math.floor((paneHeight - Math.round(30 * uiScale)) / lineH));

  ctx.fillStyle = '#0b0f16';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#171d28';
  ctx.fillRect(x, y, panelW, panelH);
  ctx.strokeStyle = '#4f6075';
  ctx.strokeRect(x, y, panelW, panelH);

  ctx.fillStyle = '#e8eef5';
  ctx.font = `${Math.round(28 * uiScale)}px monospace`;
  ctx.fillText('Stash', x + Math.round(20 * uiScale), y + Math.round(42 * uiScale));
  ctx.fillStyle = '#a7b7c7';
  ctx.font = `${Math.round(12 * uiScale)}px monospace`;
  ctx.fillText('Left pane: persistent stash  |  Right pane: last run items', x + Math.round(20 * uiScale), y + Math.round(66 * uiScale));

  ctx.strokeStyle = game.hubStashPane === 'stash' ? '#d9ecff' : '#394754';
  ctx.strokeRect(leftX, paneTop, paneW, paneHeight);
  ctx.strokeStyle = game.hubStashPane === 'run' ? '#d9ecff' : '#394754';
  ctx.strokeRect(rightX, paneTop, paneW, paneHeight);

  ctx.fillStyle = '#d7e3f0';
  ctx.font = `${Math.round(14 * uiScale)}px monospace`;
  ctx.fillText(`Stash (${game.saveData.stash.length})`, leftX + Math.round(8 * uiScale), paneTop + Math.round(20 * uiScale));
  ctx.fillText(`Run Items (${game.hubRunCarryover.length})`, rightX + Math.round(8 * uiScale), paneTop + Math.round(20 * uiScale));

  // Scroll views for both panes
  const stashItems = game.saveData.stash || [];
  const stashSv = getScrollView(game.hubStashCursor, game.hubStashScrollOffset, stashItems.length, maxVisible);
  game.hubStashScrollOffset = stashSv.scrollOffset;
  const runSv = getScrollView(game.hubRunItemsCursor, game.hubRunScrollOffset, game.hubRunCarryover.length, maxVisible);
  game.hubRunScrollOffset = runSv.scrollOffset;

  // Draw left pane (persistent stash) with scrolling
  for (let i = stashSv.startIdx; i < stashSv.endIdx; i++) {
    const row = i - stashSv.startIdx;
    const selected = game.hubStashPane === 'stash' && i === game.hubStashCursor;
    if (selected) {
      ctx.fillStyle = '#2b3a4d';
      ctx.fillRect(leftX + Math.round(6 * uiScale), startY - Math.round(16 * uiScale) + row * lineH, paneW - Math.round(12 * uiScale), Math.round(20 * uiScale));
    }
    ctx.fillStyle = selected ? '#ffffff' : getRarityColor(stashItems[i].rarity, '#b6c6d6');
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    ctx.fillText(truncateLabel(stashItems[i].name, 24), leftX + Math.round(10 * uiScale), startY + row * lineH);
  }
  drawScrollIndicators(ctx, leftX + Math.round(8 * uiScale),
    paneTop + Math.round(28 * uiScale), paneTop + paneHeight - Math.round(6 * uiScale),
    stashSv.showUpArrow, stashSv.showDownArrow, uiScale);

  // Draw right pane (run items) with scrolling
  for (let i = runSv.startIdx; i < runSv.endIdx; i++) {
    const row = i - runSv.startIdx;
    const selected = game.hubStashPane === 'run' && i === game.hubRunItemsCursor;
    if (selected) {
      ctx.fillStyle = '#2b3a4d';
      ctx.fillRect(rightX + Math.round(6 * uiScale), startY - Math.round(16 * uiScale) + row * lineH, paneW - Math.round(12 * uiScale), Math.round(20 * uiScale));
    }
    const item = game.hubRunCarryover[i];
    ctx.fillStyle = selected ? '#ffffff' : getRarityColor(item.rarity, '#b6c6d6');
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    ctx.fillText(truncateLabel(item.name, 24), rightX + Math.round(10 * uiScale), startY + row * lineH);
  }
  drawScrollIndicators(ctx, rightX + Math.round(8 * uiScale),
    paneTop + Math.round(28 * uiScale), paneTop + paneHeight - Math.round(6 * uiScale),
    runSv.showUpArrow, runSv.showDownArrow, uiScale);

  // Bottom section: item inspect + status
  const bottomY = paneTop + paneHeight + Math.round(10 * uiScale);
  const selectedItem = game.hubStashPane === 'stash'
    ? (stashItems[game.hubStashCursor] || null)
    : (game.hubRunCarryover[game.hubRunItemsCursor] || null);
  const summaryLines = getStashItemSummaryLines(game, selectedItem);
  if (selectedItem && game.hubStashPane === 'stash') {
    summaryLines.push(`Sell value: ${getItemSellValue(selectedItem)} essence`);
  }
  ctx.font = `${Math.round(11 * uiScale)}px monospace`;
  for (let i = 0; i < Math.min(4, summaryLines.length); i++) {
    ctx.fillStyle = i === 0 && selectedItem ? getRarityColor(selectedItem.rarity, '#d6dbe2') : '#b8c0ca';
    ctx.fillText(summaryLines[i], x + Math.round(20 * uiScale), bottomY + i * Math.round(15 * uiScale));
  }

  const statusY = bottomY + Math.round(50 * uiScale);
  ctx.font = `${Math.round(12 * uiScale)}px monospace`;
  if (game.pendingStashLoadoutItem) {
    ctx.fillStyle = '#a3c9f0';
    ctx.fillText(`Next run loadout: ${game.pendingStashLoadoutItem.name}`, x + Math.round(20 * uiScale), statusY);
  }
  if (game.hubNotice) {
    ctx.fillStyle = '#d9e7f5';
    ctx.fillText(game.hubNotice, x + Math.round(20 * uiScale), statusY + Math.round(16 * uiScale));
  }

  ctx.fillStyle = '#7d8e9f';
  let controls;
  if (game.pendingStashLoadoutItem) {
    controls = 'Arrows: navigate  Enter/Z: move  X: unqueue loadout  ESC: Back';
  } else {
    controls = 'Arrows: navigate  Enter/Z: move  X: sell item  ESC: Back';
  }
  ctx.fillText(controls, x + Math.round(20 * uiScale), y + panelH - Math.round(12 * uiScale));
}

export function drawHubAchievements(game) {
  const ctx = game.ctx;
  const w = game.canvas.width;
  const h = game.canvas.height;
  const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));
  const panelW = Math.min(Math.round(860 * uiScale), w - 40);
  const panelH = Math.min(Math.round(460 * uiScale), h - 40);
  const x = Math.floor((w - panelW) / 2);
  const y = Math.floor((h - panelH) / 2);
  const listW = Math.round(panelW * 0.48);
  const detailX = x + listW + Math.round(20 * uiScale);
  const startY = y + Math.round(90 * uiScale);
  const lineH = Math.round(26 * uiScale);

  ctx.fillStyle = '#0b0f16';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#171d28';
  ctx.fillRect(x, y, panelW, panelH);
  ctx.strokeStyle = '#4f6075';
  ctx.strokeRect(x, y, panelW, panelH);
  ctx.beginPath();
  ctx.moveTo(x + listW, y + Math.round(70 * uiScale));
  ctx.lineTo(x + listW, y + panelH - Math.round(20 * uiScale));
  ctx.stroke();

  ctx.fillStyle = '#e8eef5';
  ctx.font = `${Math.round(28 * uiScale)}px monospace`;
  ctx.fillText('Achievements', x + Math.round(20 * uiScale), y + Math.round(42 * uiScale));

  const bottomY = y + panelH - Math.round(40 * uiScale);
  const maxVisible = Math.max(1, Math.floor((bottomY - startY) / lineH));
  const sv = getScrollView(game.hubAchievementsCursor, game.hubAchievementsScrollOffset, ACHIEVEMENTS.length, maxVisible);
  game.hubAchievementsScrollOffset = sv.scrollOffset;

  for (let i = sv.startIdx; i < sv.endIdx; i++) {
    const row = i - sv.startIdx;
    const ach = ACHIEVEMENTS[i];
    const record = game.saveData.achievements[ach.id] || { progress: 0, unlocked: false };
    const selected = i === game.hubAchievementsCursor;
    if (selected) {
      ctx.fillStyle = '#2b3a4d';
      ctx.fillRect(x + Math.round(16 * uiScale), startY - Math.round(17 * uiScale) + row * lineH, listW - Math.round(28 * uiScale), Math.round(22 * uiScale));
    }
    ctx.fillStyle = record.unlocked ? '#9ce2a3' : (selected ? '#ffffff' : '#b8c7d7');
    ctx.font = `${Math.round(13 * uiScale)}px monospace`;
    ctx.fillText(`${ach.name}`, x + Math.round(22 * uiScale), startY + row * lineH);
  }
  drawScrollIndicators(ctx, x + Math.round(22 * uiScale),
    startY - Math.round(28 * uiScale), bottomY,
    sv.showUpArrow, sv.showDownArrow, uiScale);

  const selectedAchievement = getSelectedAchievement(game);
  if (selectedAchievement) {
    const record = game.saveData.achievements[selectedAchievement.id] || { progress: 0, unlocked: false };
    const target = selectedAchievement.condition?.count || 1;
    ctx.fillStyle = '#d7e3f0';
    ctx.font = `${Math.round(16 * uiScale)}px monospace`;
    ctx.fillText(selectedAchievement.name, detailX, y + Math.round(96 * uiScale));
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    ctx.fillStyle = '#afc0d2';
    ctx.fillText(selectedAchievement.description, detailX, y + Math.round(124 * uiScale));
    ctx.fillText(`Progress: ${Math.min(record.progress || 0, target)} / ${target}`, detailX, y + Math.round(148 * uiScale));
    ctx.fillStyle = record.unlocked ? '#9ce2a3' : '#c8d4e0';
    ctx.fillText(record.unlocked ? 'Unlocked' : 'Locked', detailX, y + Math.round(172 * uiScale));
  }

  if (game.hubNotice) {
    ctx.fillStyle = '#d9e7f5';
    ctx.font = `${Math.round(12 * uiScale)}px monospace`;
    ctx.fillText(game.hubNotice, x + Math.round(20 * uiScale), y + panelH - Math.round(34 * uiScale));
  }
  ctx.fillStyle = '#7d8e9f';
  ctx.font = `${Math.round(12 * uiScale)}px monospace`;
  ctx.fillText('Up/Down: Select  ESC: Back', x + Math.round(20 * uiScale), y + panelH - Math.round(14 * uiScale));
}

export function drawPauseMenu(game) {
  const ctx = game.ctx;
  const w = game.canvas.width;
  const h = game.canvas.height;
  const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));

  // Darken overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, w, h);

  const panelW = Math.round(300 * uiScale);
  const panelH = Math.round(240 * uiScale);
  const px = Math.floor((w - panelW) / 2);
  const py = Math.floor((h - panelH) / 2);

  ctx.fillStyle = '#171d28';
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = '#4f6075';
  ctx.strokeRect(px, py, panelW, panelH);

  ctx.fillStyle = '#e8eef5';
  ctx.font = `${Math.round(22 * uiScale)}px monospace`;
  ctx.fillText('Paused', px + Math.round(20 * uiScale), py + Math.round(36 * uiScale));

  const options = ['Resume', 'Skill Tree', 'Settings', 'Save & Quit', 'Abandon Run'];
  const lineH = Math.round(28 * uiScale);
  const startY = py + Math.round(70 * uiScale);
  ctx.font = `${Math.round(14 * uiScale)}px monospace`;

  for (let i = 0; i < options.length; i++) {
    const selected = i === game.pauseMenuIndex;
    if (selected) {
      ctx.fillStyle = '#2b3a4d';
      ctx.fillRect(px + Math.round(10 * uiScale), startY + i * lineH - Math.round(16 * uiScale), panelW - Math.round(20 * uiScale), Math.round(22 * uiScale));
    }
    ctx.fillStyle = selected ? '#ffffff' : '#a0aab5';
    ctx.fillText(options[i], px + Math.round(20 * uiScale), startY + i * lineH);
  }
}

export function drawSettingsMenu(game) {
  const ctx = game.ctx;
  const w = game.canvas.width;
  const h = game.canvas.height;
  const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));

  // Dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, w, h);

  // Panel
  const panelW = Math.round(380 * uiScale);
  const panelH = Math.round(260 * uiScale);
  const px = Math.floor((w - panelW) / 2);
  const py = Math.floor((h - panelH) / 2);

  ctx.fillStyle = '#171d28';
  ctx.fillRect(px, py, panelW, panelH);
  ctx.strokeStyle = '#4f6075';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, panelW, panelH);

  // Title
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8eef5';
  ctx.font = `bold ${Math.round(20 * uiScale)}px monospace`;
  ctx.fillText('Settings', px + Math.round(20 * uiScale), py + Math.round(32 * uiScale));

  // Rows
  const lineH = Math.round(36 * uiScale);
  const startY = py + Math.round(75 * uiScale);
  ctx.font = `${Math.round(14 * uiScale)}px monospace`;

  const rows = [
    { label: 'SFX Volume', type: 'volume', value: game.audio ? game.audio.sfxVolume : 0.7 },
    { label: 'Ambient Volume', type: 'volume', value: game.audio ? game.audio.ambientVolume : 0.7 },
    { label: 'Preview Music', type: 'biome' },
    { label: 'Back', type: 'action' },
  ];

  const labelX = px + Math.round(20 * uiScale);
  const barX = px + Math.round(200 * uiScale);
  const barW = Math.round(120 * uiScale);
  const barH = Math.round(10 * uiScale);

  for (let i = 0; i < rows.length; i++) {
    const selected = i === game.settingsMenuIndex;
    const rowY = startY + i * lineH;

    // Selection highlight
    if (selected) {
      ctx.fillStyle = '#2b3a4d';
      ctx.fillRect(px + Math.round(8 * uiScale), rowY - Math.round(14 * uiScale),
                    panelW - Math.round(16 * uiScale), Math.round(28 * uiScale));
    }

    // Label
    ctx.fillStyle = selected ? '#ffffff' : '#a0aab5';
    ctx.fillText(rows[i].label, labelX, rowY);

    if (rows[i].type === 'volume') {
      // Volume bar background
      const barY = rowY - Math.round(4 * uiScale);
      ctx.fillStyle = '#2a2a3a';
      ctx.fillRect(barX, barY, barW, barH);
      // Filled portion
      ctx.fillStyle = selected ? '#5fcf80' : '#3a7a50';
      ctx.fillRect(barX, barY, Math.round(barW * rows[i].value), barH);
      // Border
      ctx.strokeStyle = '#4f6075';
      ctx.strokeRect(barX, barY, barW, barH);
      // Percentage
      ctx.fillStyle = selected ? '#ffffff' : '#a0aab5';
      ctx.fillText(`${Math.round(rows[i].value * 100)}%`, barX + barW + Math.round(10 * uiScale), rowY);
    }

    if (rows[i].type === 'biome') {
      const biomeLabel = game.settingsPreviewBiome
        ? game.settingsPreviewBiome.replace(/_/g, ' ')
        : '< select >';
      ctx.fillStyle = selected ? '#ffd760' : '#8a9aaa';
      ctx.fillText('\u25C0 ' + biomeLabel + ' \u25B6', barX, rowY);
    }
  }

  // Footer hint
  ctx.fillStyle = '#4a5a6a';
  ctx.font = `${Math.round(11 * uiScale)}px monospace`;
  ctx.fillText('\u2190\u2192 adjust   Enter: play   Esc: back',
               px + Math.round(20 * uiScale), py + panelH - Math.round(18 * uiScale));
}

export function drawSkillTree(game) {
  const ctx = game.ctx;
  const w = game.canvas.width;
  const h = game.canvas.height;
  const uiScale = Math.max(1, Math.min(1.5, Math.min(w, h) / 900));

  if (!game.saveData) return;

  const classKey = game.player?.playerClass || game.selectedClass;
  const nodes = getSkillTreeNodes(game);
  const investments = game.saveData.skillInvestments[classKey] || {};
  const level = game.saveData.classLevels[classKey] || 1;
  const xp = game.saveData.classXP[classKey] || 0;
  const available = game.saveData.skillPoints[classKey] || 0;
  const nextLevelXP = getXPForNextLevel(level);

  const panelW = Math.min(Math.round(600 * uiScale), w - 40);
  const panelH = Math.min(Math.round(500 * uiScale), h - 40);
  const x = Math.floor((w - panelW) / 2);
  const y = Math.floor((h - panelH) / 2);

  // Background
  ctx.fillStyle = '#0b0f16';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#151c28';
  ctx.fillRect(x, y, panelW, panelH);
  ctx.strokeStyle = '#3d5070';
  ctx.strokeRect(x, y, panelW, panelH);

  // Header
  const className = classKey.charAt(0).toUpperCase() + classKey.slice(1);
  const fromHub = game.skillTreeReturnState === 'hubMenu';
  ctx.fillStyle = '#e8eef5';
  ctx.font = `bold ${Math.round(18 * uiScale)}px monospace`;
  const headerText = fromHub ? `< ${className} Skill Tree >` : `${className} Skill Tree`;
  ctx.fillText(headerText, x + Math.round(20 * uiScale), y + Math.round(30 * uiScale));

  // Level and XP
  ctx.fillStyle = '#afc0d2';
  ctx.font = `${Math.round(12 * uiScale)}px monospace`;
  const xpText = nextLevelXP ? `XP: ${xp}/${nextLevelXP}` : `XP: ${xp} (MAX)`;
  ctx.fillText(`Level ${level}  ${xpText}  Points: ${available}`, x + Math.round(20 * uiScale), y + Math.round(50 * uiScale));

  // XP bar
  const barX = x + Math.round(20 * uiScale);
  const barY = y + Math.round(56 * uiScale);
  const barW = panelW - Math.round(40 * uiScale);
  const barH = Math.round(6 * uiScale);
  ctx.fillStyle = '#1a2030';
  ctx.fillRect(barX, barY, barW, barH);
  if (nextLevelXP) {
    const prevXP = XP_TABLE[level - 1] || 0;
    const progress = Math.min(1, (xp - prevXP) / (nextLevelXP - prevXP));
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(barX, barY, barW * progress, barH);
  } else {
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(barX, barY, barW, barH);
  }

  // Skill nodes — build flat display rows (branch headers + nodes)
  const nodeStartY = y + Math.round(74 * uiScale);
  const lineH = Math.round(24 * uiScale);
  const detailY = y + panelH - Math.round(92 * uiScale);
  const listAreaH = detailY - nodeStartY - Math.round(8 * uiScale);
  const maxVisible = Math.max(1, Math.floor(listAreaH / lineH));

  const branches = [...new Set(nodes.map(n => n.branch))];
  const displayRows = [];
  for (const branch of branches) {
    const branchNodes = nodes.filter(n => n.branch === branch);
    const branchLabel = branch.charAt(0).toUpperCase() + branch.slice(1);
    displayRows.push({ type: 'branch', label: branchLabel });
    for (const node of branchNodes) {
      displayRows.push({ type: 'node', nodeIdx: nodes.indexOf(node), node });
    }
  }

  // Clamp scroll to keep cursor visible (using display-row index)
  const cursorDisplayIdx = displayRows.findIndex(r => r.type === 'node' && r.nodeIdx === game.skillTreeCursor);
  if (cursorDisplayIdx >= 0) {
    if (cursorDisplayIdx < game.skillTreeScrollOffset) game.skillTreeScrollOffset = cursorDisplayIdx;
    if (cursorDisplayIdx >= game.skillTreeScrollOffset + maxVisible) game.skillTreeScrollOffset = cursorDisplayIdx - maxVisible + 1;
  }
  if (game.skillTreeScrollOffset > displayRows.length - maxVisible) game.skillTreeScrollOffset = Math.max(0, displayRows.length - maxVisible);

  const startRow = game.skillTreeScrollOffset;
  const endRow = Math.min(displayRows.length, startRow + maxVisible);

  for (let i = startRow; i < endRow; i++) {
    const row = displayRows[i];
    const rowY = nodeStartY + (i - startRow) * lineH;

    if (row.type === 'branch') {
      ctx.fillStyle = '#6a8ab0';
      ctx.font = `bold ${Math.round(11 * uiScale)}px monospace`;
      ctx.fillText(`── ${row.label} ──`, x + Math.round(20 * uiScale), rowY);
    } else {
      const { node, nodeIdx } = row;
      const rank = investments[node.id] || 0;
      const canInv = canInvestSkill(classKey, node.id, investments) && available > 0;
      const isMaxed = rank >= node.maxRank;

      if (nodeIdx === game.skillTreeCursor) {
        ctx.fillStyle = '#1f2d42';
        ctx.fillRect(x + Math.round(10 * uiScale), rowY - Math.round(14 * uiScale), panelW - Math.round(20 * uiScale), Math.round(20 * uiScale));
      }

      ctx.fillStyle = '#4a5568';
      ctx.font = `${Math.round(10 * uiScale)}px monospace`;
      ctx.fillText(`T${node.tier}`, x + Math.round(20 * uiScale), rowY);

      ctx.fillStyle = isMaxed ? '#9ce2a3' : (rank > 0 ? '#e8eef5' : (canInv ? '#c8d4e0' : '#5a6a7a'));
      ctx.font = `${Math.round(12 * uiScale)}px monospace`;
      ctx.fillText(node.name, x + Math.round(50 * uiScale), rowY);

      ctx.fillStyle = isMaxed ? '#9ce2a3' : '#afc0d2';
      ctx.fillText(`${rank}/${node.maxRank}`, x + Math.round(280 * uiScale), rowY);

      ctx.fillStyle = node.skillType === 'active' ? '#ff9f43' : '#7ad1d1';
      ctx.font = `${Math.round(9 * uiScale)}px monospace`;
      ctx.fillText(node.skillType === 'active' ? 'ACT' : 'PAS', x + Math.round(330 * uiScale), rowY);
    }
  }
  drawScrollIndicators(ctx, x + Math.round(20 * uiScale),
    nodeStartY - Math.round(12 * uiScale), detailY - Math.round(6 * uiScale),
    startRow > 0, endRow < displayRows.length, uiScale);

  // Selected node detail
  if (game.skillTreeCursor < nodes.length) {
    const selected = nodes[game.skillTreeCursor];
    const rank = investments[selected.id] || 0;

    ctx.fillStyle = '#1a2535';
    ctx.fillRect(x + Math.round(10 * uiScale), detailY, panelW - Math.round(20 * uiScale), Math.round(72 * uiScale));

    ctx.fillStyle = '#e8eef5';
    ctx.font = `${Math.round(13 * uiScale)}px monospace`;
    const typeLabel = selected.skillType === 'active' ? `Active (CD ${selected.cooldown})` : 'Passive';
    ctx.fillText(`${selected.name}  [${typeLabel}]  Rank ${rank}/${selected.maxRank}`, x + Math.round(20 * uiScale), detailY + Math.round(16 * uiScale));

    ctx.fillStyle = '#afc0d2';
    ctx.font = `${Math.round(11 * uiScale)}px monospace`;
    ctx.fillText(selected.description, x + Math.round(20 * uiScale), detailY + Math.round(34 * uiScale));

    let infoY = detailY + Math.round(48 * uiScale);
    if (selected.prerequisites.length > 0) {
      const prereqNames = selected.prerequisites.map(p => {
        const pNode = nodes.find(n => n.id === p.skillId);
        return `${pNode?.name || p.skillId} ${p.minRank}+`;
      }).join(', ');
      ctx.fillStyle = '#7a8a9a';
      ctx.fillText(`Requires: ${prereqNames}`, x + Math.round(20 * uiScale), infoY);
      infoY += Math.round(14 * uiScale);
    }
    if (rank > 0 && rank < selected.maxRank) {
      ctx.fillStyle = '#9ce2a3';
      ctx.fillText(`Next rank: ${rank + 1}/${selected.maxRank}`, x + Math.round(20 * uiScale), infoY);
    } else if (rank >= selected.maxRank) {
      ctx.fillStyle = '#9ce2a3';
      ctx.fillText('MAX RANK', x + Math.round(20 * uiScale), infoY);
    }
  }

  // Controls
  ctx.fillStyle = '#7d8e9f';
  ctx.font = `${Math.round(11 * uiScale)}px monospace`;
  const controlsText = fromHub
    ? 'L/R: Class  Up/Down: Select  Enter: Invest  ESC: Close'
    : 'Up/Down: Select  Enter/Space: Invest  ESC: Close';
  ctx.fillText(controlsText, x + Math.round(20 * uiScale), y + panelH - Math.round(12 * uiScale));
}
