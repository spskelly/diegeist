export function isSameStack(a, b) {
  return !!a && !!b && a.stackable && b.stackable && a.name === b.name && a.effect === b.effect && a.rarity === b.rarity;
}

export function addToInventory(entity, item) {
  // stackable consumables merge into an existing stack on the belt or in the bag
  if (item.stackable) {
    const qty = item.count || 1;
    const beltStack = entity.belt.find(b => isSameStack(b, item));
    if (beltStack) {
      beltStack.count = (beltStack.count || 1) + qty;
      return true;
    }
    const bagStack = entity.inventory.find(i => isSameStack(i, item));
    if (bagStack) {
      bagStack.count = (bagStack.count || 1) + qty;
      return true;
    }
    item.count = qty;
  }
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
  const sourceIndex = entity.inventory.findIndex(i => i.id === itemId);
  if (sourceIndex === -1) return false;
  const item = entity.inventory[sourceIndex];
  if (!item || !item.slot) return false;

  entity.inventory.splice(sourceIndex, 1);

  const currentlyEquipped = entity.equipment[item.slot];
  if (currentlyEquipped) {
    // Preserve the original grid slot when swapping gear.
    entity.inventory.splice(Math.min(sourceIndex, entity.inventory.length), 0, currentlyEquipped);
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
  // a stack of several uses stays on the belt; hand back a single-use copy
  if ((item.count || 1) > 1) {
    item.count -= 1;
    return { ...item, count: 1 };
  }
  entity.belt[beltSlot] = null;
  return item;
}

export function refillBeltSlotWithMatchingConsumable(entity, beltSlot, consumedItem) {
  if (!consumedItem || consumedItem.type !== 'consumable') return null;
  if (beltSlot < 0 || beltSlot > 2) return null;
  if (entity.belt[beltSlot]) return null;

  const idx = entity.inventory.findIndex(i =>
    i.type === 'consumable' &&
    i.name === consumedItem.name &&
    i.effect === consumedItem.effect &&
    i.rarity === consumedItem.rarity
  );
  if (idx === -1) return null;

  const replacement = entity.inventory.splice(idx, 1)[0];
  entity.belt[beltSlot] = replacement;
  return replacement;
}
