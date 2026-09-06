import { describe, it, expect } from 'vitest';
import { createPlayer } from '../src/player.js';
import { createStarterWeapon } from '../src/items.js';
import { MessageLog } from '../src/message-log.js';
import { SaveData } from '../src/progression.js';
import { LOADOUT_SLOT_COUNT } from '../src/constants.js';
import { getHubMenuOptions, getStashPaneItems, getLoadoutLabel } from '../src/game-utils.js';
import {
  captureRunItemsForHub,
  restoreRunCarryover,
  clearRunCarryover,
  requestStartRun,
  queueLoadoutItem,
  unqueueLoadoutItem,
  applyPendingHubLoadout,
} from '../src/game-save.js';

let nextId = 1;
function item(name, slot, extra = {}) {
  return { id: `it_${nextId++}`, name, slot, type: 'weapon', rarity: 'common', statBonuses: { STR: 1 }, ...extra };
}

function makeGame() {
  const player = createPlayer('fighter', 1, 1);
  const sword = createStarterWeapon('fighter');
  player.equipment[sword.slot] = sword;
  player.equipment.head = item('Dented Helmet', 'head', { type: 'armor' });
  player.inventory.push(item('Spare Dagger', 'leftHand'));
  player.inventory.push({ id: 'pot', name: 'Minor Health Potion', type: 'consumable', effect: 'heal' });
  const game = {
    player,
    saveData: new SaveData(),
    messageLog: new MessageLog(),
    turnCount: 0,
    treePassiveEffects: null,
    hubRunCarryover: [],
    hubCanStashMultipleFromRun: false,
    hubStashedFromRunCount: 0,
    hubRunItemsCursor: 0,
    hubNotice: '',
    startRunConfirmPending: false,
    audio: null,
    started: 0,
    startNewRun() { this.started++; },
  };
  return game;
}

describe('captureRunItemsForHub', () => {
  it('moves equipped gear straight into the stash after a victory and leaves bag gear in the run pane', () => {
    const game = makeGame();
    const result = captureRunItemsForHub(game, true);
    expect(result.autoStashed).toBe(2);
    expect(game.saveData.stash.map(i => i.name).sort()).toEqual(['Dented Helmet', 'Rusty Sword']);
    expect(game.hubRunCarryover.map(i => i.name)).toEqual(['Spare Dagger']);
    expect(game.hubCanStashMultipleFromRun).toBe(true);
    expect(game.victoryNotice).toContain('2 equipped items moved to your stash');
    expect(game.victoryNotice).toContain('1 bag item waiting');
    // persisted for a reload between runs
    expect(game.saveData.runCarryover.items.map(i => i.name)).toEqual(['Spare Dagger']);
    expect(game.saveData.runCarryover.victory).toBe(true);
  });

  it('keeps everything in the run pane after a death', () => {
    const game = makeGame();
    const result = captureRunItemsForHub(game, false);
    expect(result.autoStashed).toBe(0);
    expect(game.saveData.stash).toHaveLength(0);
    expect(game.hubRunCarryover.map(i => i.name).sort()).toEqual(['Dented Helmet', 'Rusty Sword', 'Spare Dagger']);
    expect(game.hubCanStashMultipleFromRun).toBe(false);
    expect(game.victoryNotice).toBe('');
  });

  it('leaves equipped gear in the run pane when the stash is full', () => {
    const game = makeGame();
    for (let i = 0; i < 30; i++) game.saveData.addToStash(item(`Junk ${i}`, 'legs'));
    const result = captureRunItemsForHub(game, true);
    expect(result.autoStashed).toBe(0);
    expect(game.hubRunCarryover).toHaveLength(3);
  });
});

describe('run carryover persistence', () => {
  it('survives a serialize/deserialize round trip and restores into a fresh game', () => {
    const game = makeGame();
    captureRunItemsForHub(game, false);
    game.hubStashedFromRunCount = 1;
    const json = game.saveData.serialize();
    const fresh = { saveData: SaveData.deserialize(json), hubRunCarryover: [], hubRunItemsCursor: 3 };
    restoreRunCarryover(fresh);
    expect(fresh.hubRunCarryover.map(i => i.name).sort()).toEqual(['Dented Helmet', 'Rusty Sword', 'Spare Dagger']);
    expect(fresh.hubCanStashMultipleFromRun).toBe(false);
    expect(fresh.hubRunItemsCursor).toBe(0);
    clearRunCarryover(fresh);
    expect(fresh.hubRunCarryover).toEqual([]);
    expect(fresh.saveData.runCarryover).toBeNull();
  });

  it('migrates the old single pendingLoadoutItem into the loadout list', () => {
    const save = new SaveData();
    const raw = JSON.parse(save.serialize());
    delete raw.pendingLoadout;
    raw.pendingLoadoutItem = item('Old Bow', 'leftHand');
    const loaded = SaveData.deserialize(JSON.stringify(raw));
    expect(loaded.pendingLoadout.map(i => i.name)).toEqual(['Old Bow']);
    expect(loaded.pendingLoadoutItem).toBeUndefined();
    expect(loaded.runCarryover).toBeNull();
  });
});

describe('loadout queue', () => {
  it('queues up to the slot limit, one item per equipment slot', () => {
    const game = makeGame();
    const save = game.saveData;
    save.addToStash(item('Sword A', 'leftHand'));
    save.addToStash(item('Helm A', 'head'));
    save.addToStash(item('Boots A', 'legs'));
    save.addToStash(item('Ring A', 'accessory1'));
    save.addToStash(item('Sword B', 'leftHand'));
    expect(queueLoadoutItem(game, 0).name).toBe('Sword A');
    expect(queueLoadoutItem(game, 0).name).toBe('Helm A');
    expect(queueLoadoutItem(game, 0).name).toBe('Boots A');
    expect(save.pendingLoadout).toHaveLength(LOADOUT_SLOT_COUNT);
    // fourth distinct slot is refused
    expect(queueLoadoutItem(game, 0)).toBeNull();
    expect(game.hubNotice).toContain('Loadout is full');
    // a second weapon swaps the first one back into the stash
    const swapped = queueLoadoutItem(game, 1);
    expect(swapped.name).toBe('Sword B');
    expect(save.pendingLoadout.map(i => i.name)).toEqual(['Helm A', 'Boots A', 'Sword B']);
    expect(save.stash.map(i => i.name)).toEqual(['Ring A', 'Sword A']);
    expect(getLoadoutLabel(save)).toBe(`3/${LOADOUT_SLOT_COUNT}`);
    expect(getHubMenuOptions(game)[0]).toBe(`Start Run (loadout 3/${LOADOUT_SLOT_COUNT})`);
  });

  it('unqueues back into the stash and lists loadout rows before stash rows', () => {
    const game = makeGame();
    const save = game.saveData;
    save.addToStash(item('Sword A', 'leftHand'));
    save.addToStash(item('Helm A', 'head'));
    queueLoadoutItem(game, 1);
    const rows = getStashPaneItems({ hubStashPane: 'stash', saveData: save });
    expect(rows.map(i => i.name)).toEqual(['Helm A', 'Sword A']);
    expect(unqueueLoadoutItem(game, 0).name).toBe('Helm A');
    expect(save.pendingLoadout).toEqual([]);
    expect(save.stash.map(i => i.name)).toEqual(['Sword A', 'Helm A']);
    expect(unqueueLoadoutItem(game, 0)).toBeNull();
  });

  it('brings every queued item into the run and wears what fits', () => {
    const game = makeGame();
    game.player = createPlayer('fighter', 1, 1);
    game.saveData.pendingLoadout = [
      item('Queued Sword', 'leftHand'),
      item('Queued Helm', 'head', { type: 'armor' }),
      item('Queued Boots', 'legs', { type: 'armor' }),
    ];
    applyPendingHubLoadout(game);
    expect(game.player.equipment.leftHand.name).toBe('Queued Sword');
    expect(game.player.equipment.head.name).toBe('Queued Helm');
    expect(game.player.equipment.legs.name).toBe('Queued Boots');
    expect(game.saveData.pendingLoadout).toEqual([]);
  });
});

describe('requestStartRun', () => {
  it('starts straight away when nothing is waiting in the run pane', () => {
    const game = makeGame();
    expect(requestStartRun(game)).toBe(true);
    expect(game.started).toBe(1);
  });

  it('warns once when run items would be lost, then starts on the second confirm', () => {
    const game = makeGame();
    captureRunItemsForHub(game, false);
    expect(requestStartRun(game)).toBe(false);
    expect(game.started).toBe(0);
    expect(game.startRunConfirmPending).toBe(true);
    expect(game.hubNotice).toContain('3 run items not stashed will be lost');
    expect(requestStartRun(game)).toBe(true);
    expect(game.started).toBe(1);
    expect(game.startRunConfirmPending).toBe(false);
  });
});
