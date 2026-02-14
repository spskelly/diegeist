export function addToInventory(entity, item) {
  if (entity.inventory.length >= 12) return false;
  entity.inventory.push(item);
  return true;
}

export function removeFromInventory(entity, itemId) {
  const idx = entity.inventory.findIndex(i => i.id === itemId);
  if (idx === -1) return null;
  return entity.inventory.splice(idx, 1)[0];
}

export function equipItem(entity, itemId) {
  const item = removeFromInventory(entity, itemId);
  if (!item || !item.slot) return false;

  const currentlyEquipped = entity.equipment[item.slot];
  if (currentlyEquipped) {
    entity.inventory.push(currentlyEquipped);
  }

  entity.equipment[item.slot] = item;
  return true;
}

export function autoEquipIfSlotEmpty(entity, itemId) {
  const item = entity.inventory.find(i => i.id === itemId);
  if (!item || !item.slot) return false;
  if (entity.equipment[item.slot]) return false;
  return equipItem(entity, itemId);
}

export function unequipItem(entity, slot) {
  const item = entity.equipment[slot];
  if (!item) return false;
  if (entity.inventory.length >= 12) return false;

  entity.equipment[slot] = null;
  entity.inventory.push(item);
  return true;
}

export function getEquippedStats(entity) {
  const bonuses = {};
  for (const slot of Object.keys(entity.equipment)) {
    const item = entity.equipment[slot];
    if (item && item.statBonuses) {
      for (const [stat, value] of Object.entries(item.statBonuses)) {
        bonuses[stat] = (bonuses[stat] || 0) + value;
      }
    }
  }
  return bonuses;
}

export function assignToBelt(entity, itemId, beltSlot) {
  if (beltSlot < 0 || beltSlot > 2) return false;
  const item = entity.inventory.find(i => i.id === itemId);
  if (!item || item.type !== 'consumable') return false;

  // Remove from inventory
  const idx = entity.inventory.indexOf(item);
  entity.inventory.splice(idx, 1);

  // If something is already in belt slot, move it back to inventory
  if (entity.belt[beltSlot]) {
    entity.inventory.push(entity.belt[beltSlot]);
  }

  entity.belt[beltSlot] = item;
  return true;
}

export function useBeltSlot(entity, beltSlot) {
  if (beltSlot < 0 || beltSlot > 2) return null;
  const item = entity.belt[beltSlot];
  if (!item) return null;
  entity.belt[beltSlot] = null;
  return item;
}
