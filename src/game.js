import { TurnSystem } from './turn-system.js';
import { Camera } from './camera.js';
import { computeFOV } from './fov.js';
import { FOV_RADIUS, PLAYER_CLASSES, TILE, TOWN_MOVE_DELAY, BIOME_THEMES } from './constants.js';
import { MessageLog } from './message-log.js';
import { InputHandler } from './input.js';
import { SpriteRegistry } from './sprites.js';
import { Renderer } from './renderer.js';
import { HUD } from './hud.js';
import { tickCooldowns, updateActiveSkills } from './skills.js';
import { HubShop, loadSaveData, persistSaveData, ACHIEVEMENTS } from './progression.js';
import { AudioManager, BIOME_KEYS } from './audio.js';
import { resolvePassiveEffects, canInvestSkill, investSkill, createTreeActiveSkills } from './skill-tree.js';

// game-utils.js — shared helpers
import {
  isDirectionalAction,
  cloneItem,
  getEntityStatsWithEquipment,
  getNaturalRegenInterval,
  getRegenAmount,
  recalcPlayerMaxHp,
  addFloatingText,
  updateCombatVfx,
  syncMilestoneAchievements,
  setAchievementProgress,
  getHubMenuOptions,
  getSkillTreeNodes,
  getItemSellValue,
  getStashPaneItems,
} from './game-utils.js';

// game-save.js — save/load & run lifecycle
import {
  saveRunState,
  loadRunState,
  hasSavedRun,
  startNewRun,
  finalizeRun,
} from './game-save.js';

// game-actions.js — player/enemy action processing
import {
  processPlayerAction,
  processEnemyTurn,
  handleInventoryOverlayAction,
} from './game-actions.js';

// game-floor.js — floor generation & transitions
import { startFloor, handleFloorTransition } from './game-floor.js';

// town.js — town map & spawn
import { buildTownMap, getTownSpawnPos } from './town.js';

// game-screens.js — all draw functions
import {
  drawStartMenu,
  drawDeathSplash,
  drawDeathSaveChoice,
  drawPostDeathMenu,
  drawVictoryScreen,
  drawHubMenu,
  drawHubShop,
  drawHubStash,
  drawHubAchievements,
  drawPauseMenu,
  drawSettingsMenu,
  drawSkillTree,
  drawInventoryOverlay,
  drawStatsOverlay,
  drawMapOverlay,
  drawCombatVfx,
} from './game-screens.js';
import { getXPForNextLevel, XP_TABLE } from './skill-tree.js';

// height of the status bars drawn above and below the town view
export const TOWN_BAR_HEIGHT = 30;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'init';
    this.messageLog = new MessageLog();
    this.input = new InputHandler();
    this.turnSystem = new TurnSystem();
    this.sprites = new SpriteRegistry();
    this.player = null;
    this.map = null;
    this.camera = null;
    this.renderer = null;
    this.hud = null;
    this.turnCount = 0;
    this.floorNumber = 1;
    this.saveData = null;
    this.audio = null;
    this.runSummary = null;
    this.runFinalized = false;
    this.inventoryOpen = false;
    this.statsOpen = false;
    this.mapOpen = false;
    this.inventorySection = 'equipment';
    this.inventoryCursorByTab = { inventory: 0, equipment: 0 };
    this.regenCounter = 0;
    this.classOrder = Object.keys(PLAYER_CLASSES);
    this.selectedClass = this.classOrder[0] || 'fighter';
    this.startMenuIndex = 0;
    this.postDeathMenuIndex = 0;
    this.deathSplashFrames = 0;
    this.hubMenuIndex = 0;
    this.hubShopCursor = 0;
    this.hubStashCursor = 0;
    this.hubRunItemsCursor = 0;
    this.hubStashScrollOffset = 0;
    this.hubRunScrollOffset = 0;
    this.hubAchievementsCursor = 0;
    this.hubAchievementsScrollOffset = 0;
    this.hubShopScrollOffset = 0;
    this.skillTreeScrollOffset = 0;
    this.hubStashPane = 'stash';
    this.hubNotice = '';
    this.hubRunCarryover = [];
    this.hubCanStashMultipleFromRun = false;
    this.hubStashedFromRunCount = 0;
    this.pendingStashLoadoutItem = null;
    this.hubShop = new HubShop();
    this.pauseMenuIndex = 0;
    this.settingsMenuIndex = 0;
    this.settingsPreviewBiome = null;
    this._currentAmbientBiome = null;
    this._settingsSavedAmbientBiome = null;
    this.skillTreeReturnState = 'pauseMenu';
    this.combatVfx = { floatingTexts: [], projectiles: [] };
    this.townMap = null;
    this.townPlayerPos = null;
    this.townMoveTimer = 0;
    this.townInteractPrompt = false;
  }

  init() {
    this.saveData = loadSaveData();
    this.pendingStashLoadoutItem = this.saveData.pendingLoadoutItem || null;
    if (this.saveData?.settings?.lastClass && this.classOrder.includes(this.saveData.settings.lastClass)) {
      this.selectedClass = this.saveData.settings.lastClass;
    }
    const classIdx = Math.max(0, this.classOrder.indexOf(this.selectedClass));
    this.startMenuIndex = hasSavedRun() ? classIdx + 1 : classIdx;
    this.runSummary = {
      classKey: this.selectedClass,
      floorsReached: 1,
      enemiesKilled: 0,
      currencyEarned: 0,
      causeOfDeath: null,
    };

    this.audio = new AudioManager();
    this.audio.init();
    const sfxVol = this.saveData.settings?.sfxVolume ?? this.saveData.settings?.volume ?? 0.7;
    const ambVol = this.saveData.settings?.ambientVolume ?? this.saveData.settings?.volume ?? 0.7;
    this.audio.setSfxVolume(sfxVol);
    this.audio.setAmbientVolume(ambVol);
    if (!Array.isArray(this.saveData.pendingRunPurchases)) this.saveData.pendingRunPurchases = [];
    this.refreshHubShop();

    this.resizeCanvas();
    this.sprites.init();
    this.hud = new HUD(this.ctx, this.canvas.width, this.canvas.height);
    this.camera = new Camera(this.canvas.width, this.canvas.height - this.hud.hudHeight, this.getCameraZoom());
    this.renderer = new Renderer(this.canvas, this.sprites, this.camera);
    this.input.start();

    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });

    if (this.saveData.runHistory && this.saveData.runHistory.length > 0) {
      this.enterTown();
    } else {
      this.state = 'startMenu';
    }
    this.loop();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.hud) this.hud.resize(this.canvas.width, this.canvas.height);
    this.syncCameraViewport();
  }

  // the town has no bottom hud, only two thin bars, so the camera gets a taller
  // viewport there than in the dungeon. called whenever the mode or canvas changes.
  syncCameraViewport() {
    if (!this.camera) return;
    this.camera.setZoom(this.getCameraZoom());
    const inTown = this.state === 'town' || (!this.map && this.townMap);
    const reserved = inTown ? TOWN_BAR_HEIGHT * 2 : (this.hud?.hudHeight || 80);
    this.camera.resize(this.canvas.width, Math.max(1, this.canvas.height - reserved));
    // the town bars sit at the top and bottom, so shift the viewport down past the top bar
    this.camera.offsetY += inTown ? TOWN_BAR_HEIGHT : 0;
    if (this.map && this.player) {
      this.camera.centerOn(this.player.position.x, this.player.position.y, this.map.width, this.map.height);
    } else if (this.townMap && this.townPlayerPos) {
      this.camera.centerOn(this.townPlayerPos.x, this.townPlayerPos.y, this.townMap.width, this.townMap.height);
    }
  }

  getCameraZoom() {
    const usableHeight = this.canvas.height - (this.hud?.hudHeight || 80);
    const minDimension = Math.min(this.canvas.width, usableHeight);
    if (minDimension >= 800) return 3;
    if (minDimension >= 500) return 2;
    return 1.5;
  }

  getNowMs() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  // --- Hub systems (remain here due to tight state coupling) ---

  refreshHubShop() {
    if (!this.hubShop) this.hubShop = new HubShop();
    this.hubShop.generate(this.saveData?.shopPurchases || []);
    this.hubShopCursor = 0;
  }

  enterHubMenu(notice = '') {
    this.state = 'hubMenu';
    this.player = null;
    this.map = null;
    this.hubMenuIndex = 0;
    this.hubStashPane = 'stash';
    this.hubStashCursor = 0;
    this.hubRunItemsCursor = 0;
    this.hubStashScrollOffset = 0;
    this.hubRunScrollOffset = 0;
    this.hubAchievementsCursor = 0;
    this.hubAchievementsScrollOffset = 0;
    this.hubShopScrollOffset = 0;
    this.skillTreeScrollOffset = 0;
    if (notice) this.hubNotice = notice;
    this.refreshHubShop();
    if (this.audio) this.audio.uiClick();
  }

  enterTown(notice = '') {
    this.state = 'town';
    this.player = null;
    this.map = null;
    this.townMap = buildTownMap();
    this.townPlayerPos = getTownSpawnPos(this.saveData);
    this.townMoveTimer = 0;
    this.townInteractPrompt = false;
    this.sprites.setTown(BIOME_THEMES.town.palette);
    this.syncCameraViewport();
    if (this.audio) this.audio.startAmbientBiome('town');
    this._currentAmbientBiome = 'town';
    if (notice) this.hubNotice = notice;
    this.refreshHubShop();
  }

  captureRunItemsForHub(victory = false) {
    const sourceItems = [];
    if (this.player) {
      for (const item of this.player.inventory) {
        if (item.type === 'consumable') continue;
        sourceItems.push(cloneItem(item));
      }
      for (const item of Object.values(this.player.equipment)) {
        if (item) sourceItems.push(cloneItem(item));
      }
    }
    this.hubRunCarryover = sourceItems;
    this.hubCanStashMultipleFromRun = !!victory;
    this.hubStashedFromRunCount = 0;
    this.hubRunItemsCursor = 0;
  }

  // --- Overlay toggles ---

  toggleInventoryOverlay() {
    this.inventoryOpen = !this.inventoryOpen;
    if (this.inventoryOpen) {
      this.statsOpen = false;
      this.inventorySection = 'equipment';
    }
    if (this.audio) this.audio.uiClick();
  }

  toggleMapOverlay() {
    this.mapOpen = !this.mapOpen;
    if (this.mapOpen) {
      this.inventoryOpen = false;
      this.statsOpen = false;
    }
    if (this.audio) this.audio.uiClick();
  }

  toggleStatsOverlay() {
    this.statsOpen = !this.statsOpen;
    if (this.statsOpen) {
      this.inventoryOpen = false;
      this.messageLog.add('Stats open. Press P or ESC to close.', this.turnCount);
    }
    if (this.audio) this.audio.uiClick();
  }

  // --- Natural regen ---

  applyNaturalRegen() {
    if (!this.player || this.player.hp >= this.player.maxHp) return;
    this.regenCounter++;
    const interval = getNaturalRegenInterval(this.player);
    if (this.regenCounter < interval) return;
    this.regenCounter = 0;
    const amount = getRegenAmount(this.player);
    this.player.heal(amount);
    addFloatingText(this, this.player.position.x, this.player.position.y, `+${amount} HP`, '#73e38e', 780);
    this.messageLog.add(`You recover ${amount} HP naturally.`, this.turnCount);
  }

  // --- Delegated methods (thin wrappers around extracted modules) ---

  startFloor() { startFloor(this); }
  handleFloorTransition() { return handleFloorTransition(this); }
  startNewRun() { startNewRun(this); }
  finalizeRun(causeOfDeath) { finalizeRun(this, causeOfDeath); }
  syncMilestoneAchievements() { syncMilestoneAchievements(this); }

  // --- State machine action handlers ---

  handleTownUpdate(action) {
    const currentTile = this.townMap.getTile(this.townPlayerPos.x, this.townPlayerPos.y);
    this.townInteractPrompt = (currentTile === TILE.SHELTER_ENTRANCE);

    if (action) {
      if ((action.type === 'inventoryConfirm' || action.type === 'wait') && this.townInteractPrompt) {
        this.saveData.townPlayerPos = { ...this.townPlayerPos };
        persistSaveData(this.saveData);
        this.enterHubMenu();
        return;
      }
      if (action.type === 'close') {
        this.state = 'startMenu';
        if (this.audio) this.audio.uiClick();
        return;
      }
      if (action.type === 'stats') {
        this.skillTreeCursor = 0;
        this.skillTreeScrollOffset = 0;
        this.skillTreeReturnState = 'town';
        this.state = 'skillTree';
        if (this.audio) this.audio.uiClick();
        return;
      }
    }

    const now = this.getNowMs();
    if (now - this.townMoveTimer >= TOWN_MOVE_DELAY) {
      const dir = this.input.getHeldDirection();
      if (dir) {
        const nx = this.townPlayerPos.x + dir.dx;
        const ny = this.townPlayerPos.y + dir.dy;
        if (nx >= 0 && nx < this.townMap.width && ny >= 0 && ny < this.townMap.height) {
          const props = TILE.properties[this.townMap.getTile(nx, ny)];
          if (props && props.walkable) {
            this.townPlayerPos.x = nx;
            this.townPlayerPos.y = ny;
            this.camera.centerOn(this.townPlayerPos.x, this.townPlayerPos.y, this.townMap.width, this.townMap.height);
            if (this.audio) this.audio.footstep();
            this.townMoveTimer = now;
          }
        }
      }
    }
  }

  handleStartMenuAction(action) {
    if (!action) return;
    const hasSave = hasSavedRun();
    const totalOptions = this.classOrder.length + (hasSave ? 1 : 0);

    if (isDirectionalAction(action)) {
      const delta = action.dy !== 0 ? action.dy : action.dx;
      if (delta !== 0) {
        this.startMenuIndex = (this.startMenuIndex + delta + totalOptions) % totalOptions;
        if (!hasSave || this.startMenuIndex > 0) {
          const classIdx = hasSave ? this.startMenuIndex - 1 : this.startMenuIndex;
          this.selectedClass = this.classOrder[classIdx] || this.selectedClass;
        }
        if (this.audio) this.audio.uiClick();
      }
      return;
    }
    if (action.type === 'hub') {
      this.enterTown();
      return;
    }
    if (action.type === 'inventoryConfirm' || action.type === 'wait') {
      if (hasSave && this.startMenuIndex === 0) {
        loadRunState(this);
      } else {
        this.enterTown();
      }
    }
  }

  handleDeathSplashAction(action) {
    this.deathSplashFrames++;
    if (!action || this.deathSplashFrames < 25) return;
    if (action.type === 'inventoryConfirm' || action.type === 'wait' || action.type === 'close') {
      this.state = 'deathSaveChoice';
      this.deathSaveIndex = 0;
      if (this.audio) this.audio.uiClick();
    }
  }

  handleDeathSaveChoiceAction(action) {
    if (!action) return;
    if (isDirectionalAction(action)) {
      const delta = action.dy !== 0 ? action.dy : action.dx;
      if (delta !== 0) {
        this.deathSaveIndex = (this.deathSaveIndex + 2 + delta) % 2;
        if (this.audio) this.audio.uiClick();
      }
      return;
    }
    if (action.type === 'inventoryConfirm' || action.type === 'wait') {
      if (this.deathSaveIndex === 0) {
        this.hubCanStashMultipleFromRun = false;
      } else {
        if (this.rawRunMaterials && this.committedMaterials) {
          const restored = {};
          for (const key of Object.keys(this.rawRunMaterials)) {
            const diff = this.rawRunMaterials[key] - (this.committedMaterials[key] || 0);
            if (diff > 0) restored[key] = diff;
          }
          this.saveData.addMaterials(restored);
          persistSaveData(this.saveData);
        }
        this.hubRunCarryover = [];
      }
      this.state = 'postDeathMenu';
      this.postDeathMenuIndex = 0;
    }
  }

  handlePostDeathMenuAction(action) {
    if (!action) return;
    if (isDirectionalAction(action)) {
      const delta = action.dy !== 0 ? action.dy : action.dx;
      if (delta !== 0) {
        const optionCount = 3;
        this.postDeathMenuIndex = (this.postDeathMenuIndex + delta + optionCount) % optionCount;
        if (this.audio) this.audio.uiClick();
      }
      return;
    }
    if (action.type === 'close') {
      this.state = 'startMenu';
      return;
    }
    if (action.type === 'inventoryConfirm' || action.type === 'wait') {
      if (this.postDeathMenuIndex === 0) {
        this.startNewRun();
      } else if (this.postDeathMenuIndex === 1) {
        this.enterTown();
      } else {
        this.state = 'startMenu';
      }
    }
  }

  handleVictoryAction(action) {
    if (!action) return;
    if (action.type === 'hub') {
      this.enterTown('Victory rewards available in stash.');
      return;
    }
    if (action.type === 'inventoryConfirm' || action.type === 'wait' || action.type === 'close') {
      this.enterTown();
    }
  }

  handleHubMenuAction(action) {
    if (!action) return;
    const options = getHubMenuOptions();
    if (isDirectionalAction(action)) {
      const delta = action.dy !== 0 ? action.dy : action.dx;
      if (delta !== 0) {
        this.hubMenuIndex = (this.hubMenuIndex + delta + options.length) % options.length;
        if (this.audio) this.audio.uiClick();
      }
      return;
    }
    if (action.type === 'close') {
      this.enterTown();
      return;
    }
    if (action.type === 'inventoryConfirm' || action.type === 'wait') {
      if (this.hubMenuIndex === 0) {
        this.startNewRun();
      } else if (this.hubMenuIndex === 1) {
        this.state = 'hubShop';
      } else if (this.hubMenuIndex === 2) {
        this.skillTreeCursor = 0;
        this.skillTreeScrollOffset = 0;
        this.skillTreeReturnState = 'hubMenu';
        this.state = 'skillTree';
      } else if (this.hubMenuIndex === 3) {
        this.state = 'hubStash';
      } else if (this.hubMenuIndex === 4) {
        this.state = 'hubAchievements';
      } else {
        this.state = 'startMenu';
      }
      if (this.audio) this.audio.uiClick();
    }
  }

  handleHubShopAction(action) {
    if (!action) return;
    if (action.type === 'close') {
      this.state = 'hubMenu';
      if (this.audio) this.audio.uiClick();
      return;
    }
    if (isDirectionalAction(action)) {
      const delta = action.dy !== 0 ? action.dy : action.dx;
      if (delta !== 0 && this.hubShop.items.length > 0) {
        const count = this.hubShop.items.length;
        this.hubShopCursor = (this.hubShopCursor + delta + count) % count;
        if (this.audio) this.audio.uiClick();
      }
      return;
    }
    if (action.type === 'inventoryConfirm' || action.type === 'wait') {
      const item = this.hubShop.items[this.hubShopCursor];
      if (!item) return;
      const success = this.hubShop.purchase(this.saveData, item.id);
      if (!success) {
        this.hubNotice = `Not enough essence for ${item.name}.`;
        if (this.audio) this.audio.uiClick();
        return;
      }
      this.hubNotice = `Purchased: ${item.name}.`;
      persistSaveData(this.saveData);
      this.hubShopCursor = Math.max(0, Math.min(this.hubShopCursor, this.hubShop.items.length - 1));
      if (this.audio) this.audio.blessing();
    }
  }

  handleHubAchievementsAction(action) {
    if (!action) return;
    if (action.type === 'close') {
      this.state = 'hubMenu';
      if (this.audio) this.audio.uiClick();
      return;
    }
    if (isDirectionalAction(action)) {
      const delta = action.dy !== 0 ? action.dy : action.dx;
      if (delta !== 0 && ACHIEVEMENTS.length > 0) {
        this.hubAchievementsCursor = (this.hubAchievementsCursor + delta + ACHIEVEMENTS.length) % ACHIEVEMENTS.length;
        if (this.audio) this.audio.uiClick();
      }
    }
  }

  handleHubStashAction(action) {
    if (!action) return;
    if (action.type === 'close') {
      this.state = 'hubMenu';
      if (this.audio) this.audio.uiClick();
      return;
    }
    if (isDirectionalAction(action)) {
      if (action.dx !== 0) {
        this.hubStashPane = this.hubStashPane === 'stash' ? 'run' : 'stash';
        if (this.audio) this.audio.uiClick();
        return;
      }
      if (action.dy !== 0) {
        const items = getStashPaneItems(this);
        if (items.length === 0) return;
        if (this.hubStashPane === 'stash') {
          this.hubStashCursor = (this.hubStashCursor + action.dy + items.length) % items.length;
        } else {
          this.hubRunItemsCursor = (this.hubRunItemsCursor + action.dy + items.length) % items.length;
        }
        if (this.audio) this.audio.uiClick();
      }
      return;
    }

    if (action.type === 'inventoryConfirm' || action.type === 'wait') {
      if (this.hubStashPane === 'stash') {
        if (!this.saveData.stash || this.saveData.stash.length === 0) return;
        const idx = Math.max(0, Math.min(this.hubStashCursor, this.saveData.stash.length - 1));
        const removed = this.saveData.removeFromStash(this.saveData.stash[idx].id);
        if (!removed) return;
        if (this.pendingStashLoadoutItem) {
          this.saveData.addToStash(this.pendingStashLoadoutItem);
        }
        this.pendingStashLoadoutItem = cloneItem(removed);
        this.saveData.pendingLoadoutItem = this.pendingStashLoadoutItem;
        this.hubNotice = `Queued ${removed.name} for next run.`;
        this.hubStashCursor = Math.max(0, Math.min(this.hubStashCursor, this.saveData.stash.length - 1));
        persistSaveData(this.saveData);
        if (this.audio) this.audio.itemPickup();
        return;
      }

      if (!this.hubCanStashMultipleFromRun && this.hubStashedFromRunCount >= 1) {
        this.hubNotice = 'Only one run item can be stashed after death.';
        if (this.audio) this.audio.uiClick();
        return;
      }
      if (this.hubRunCarryover.length === 0) return;
      const idx = Math.max(0, Math.min(this.hubRunItemsCursor, this.hubRunCarryover.length - 1));
      const item = this.hubRunCarryover[idx];
      const added = this.saveData.addToStash(cloneItem(item));
      if (!added) {
        this.hubNotice = 'Stash is full.';
        if (this.audio) this.audio.uiClick();
        return;
      }
      this.hubRunCarryover.splice(idx, 1);
      this.hubStashedFromRunCount++;
      this.hubNotice = `Stashed: ${item.name}.`;
      this.hubRunItemsCursor = Math.max(0, Math.min(this.hubRunItemsCursor, this.hubRunCarryover.length - 1));
      setAchievementProgress(this, 'collector', this.saveData.stash.length);
      persistSaveData(this.saveData);
      if (this.audio) this.audio.itemPickup();
    }

    if (action.type === 'inventoryDrop') {
      if (this.pendingStashLoadoutItem) {
        const returned = this.saveData.addToStash(this.pendingStashLoadoutItem);
        if (returned) {
          this.hubNotice = `Returned ${this.pendingStashLoadoutItem.name} to stash.`;
          this.pendingStashLoadoutItem = null;
          this.saveData.pendingLoadoutItem = null;
          persistSaveData(this.saveData);
          if (this.audio) this.audio.uiClick();
        } else {
          this.hubNotice = 'Stash is full.';
          if (this.audio) this.audio.uiClick();
        }
      } else if (this.hubStashPane === 'stash' && this.saveData.stash && this.saveData.stash.length > 0) {
        const idx = Math.max(0, Math.min(this.hubStashCursor, this.saveData.stash.length - 1));
        const item = this.saveData.stash[idx];
        const value = getItemSellValue(item);
        this.saveData.removeFromStash(item.id);
        this.saveData.currency = (this.saveData.currency || 0) + value;
        this.hubNotice = `Sold ${item.name} for ${value} essence.`;
        this.hubStashCursor = Math.max(0, Math.min(this.hubStashCursor, this.saveData.stash.length - 1));
        persistSaveData(this.saveData);
        if (this.audio) this.audio.uiClick();
      }
    }
  }

  handlePauseMenuAction(action) {
    if (!action) return;
    const options = ['Resume', 'Skill Tree', 'Settings', 'Save & Quit', 'Abandon Run'];
    if (action.type === 'close') {
      this.state = 'playing';
      if (this.audio) this.audio.uiClick();
      return;
    }
    if (isDirectionalAction(action)) {
      const delta = action.dy !== 0 ? action.dy : action.dx;
      if (delta !== 0) {
        this.pauseMenuIndex = (this.pauseMenuIndex + delta + options.length) % options.length;
        if (this.audio) this.audio.uiClick();
      }
      return;
    }
    if (action.type === 'inventoryConfirm' || action.type === 'wait') {
      if (this.pauseMenuIndex === 0) {
        this.state = 'playing';
      } else if (this.pauseMenuIndex === 1) {
        this.skillTreeCursor = 0;
        this.skillTreeScrollOffset = 0;
        this.skillTreeReturnState = 'pauseMenu';
        this.state = 'skillTree';
      } else if (this.pauseMenuIndex === 2) {
        this.settingsMenuIndex = 0;
        this.settingsPreviewBiome = null;
        this.state = 'settings';
      } else if (this.pauseMenuIndex === 3) {
        saveRunState(this);
        this.state = 'startMenu';
      } else if (this.pauseMenuIndex === 4) {
        this.captureRunItemsForHub(false);
        this.finalizeRun('abandoned');
        this.enterTown('Run abandoned.');
      }
      if (this.audio) this.audio.uiClick();
    }
  }

  handleSettingsAction(action) {
    if (!action) return;
    const rowCount = 4; // SFX Vol, Ambient Vol, Preview Music, Back

    if (action.type === 'close') {
      this._exitSettings();
      return;
    }

    if (isDirectionalAction(action)) {
      if (action.dy !== 0) {
        this.settingsMenuIndex = (this.settingsMenuIndex + action.dy + rowCount) % rowCount;
        if (this.audio) this.audio.uiClick();
        return;
      }
      if (action.dx !== 0) {
        if (this.settingsMenuIndex === 0) {
          // SFX volume
          const v = Math.round(Math.max(0, Math.min(1, this.audio.sfxVolume + action.dx * 0.05)) * 100) / 100;
          this.audio.setSfxVolume(v);
          this.saveData.settings.sfxVolume = this.audio.sfxVolume;
          persistSaveData(this.saveData);
          if (this.audio) this.audio.uiClick();
        } else if (this.settingsMenuIndex === 1) {
          // Ambient volume
          const v = Math.round(Math.max(0, Math.min(1, this.audio.ambientVolume + action.dx * 0.05)) * 100) / 100;
          this.audio.setAmbientVolume(v);
          this.saveData.settings.ambientVolume = this.audio.ambientVolume;
          if (this.settingsPreviewBiome) {
            this.audio.startAmbientBiome(this.settingsPreviewBiome);
          }
          persistSaveData(this.saveData);
        } else if (this.settingsMenuIndex === 2) {
          // Cycle through biome keys
          const keys = BIOME_KEYS;
          const curIdx = this.settingsPreviewBiome ? keys.indexOf(this.settingsPreviewBiome) : -1;
          const nextIdx = (curIdx + action.dx + keys.length) % keys.length;
          this.settingsPreviewBiome = keys[nextIdx];
          if (this.audio) this.audio.uiClick();
        }
        return;
      }
    }

    if (action.type === 'inventoryConfirm' || action.type === 'wait') {
      if (this.settingsMenuIndex === 2 && this.settingsPreviewBiome) {
        // Play preview
        if (!this._settingsSavedAmbientBiome && this._currentAmbientBiome) {
          this._settingsSavedAmbientBiome = this._currentAmbientBiome;
        }
        this.audio.startAmbientBiome(this.settingsPreviewBiome);
      } else if (this.settingsMenuIndex === 3) {
        this._exitSettings();
      }
      if (this.audio) this.audio.uiClick();
    }
  }

  _exitSettings() {
    if (this._settingsSavedAmbientBiome) {
      this.audio.startAmbientBiome(this._settingsSavedAmbientBiome);
      this._settingsSavedAmbientBiome = null;
    } else if (this.settingsPreviewBiome) {
      this.audio.stopAmbient();
    }
    this.settingsPreviewBiome = null;
    this.state = 'pauseMenu';
    if (this.audio) this.audio.uiClick();
  }

  handleSkillTreeAction(action) {
    if (!action) return;
    if (action.type === 'close') {
      this.state = this.skillTreeReturnState || 'pauseMenu';
      if (this.audio) this.audio.uiClick();
      return;
    }
    if (isDirectionalAction(action)) {
      const delta = action.dy || 0;
      if (delta !== 0) {
        const tree = getSkillTreeNodes(this);
        if (tree.length > 0) {
          this.skillTreeCursor = (this.skillTreeCursor + delta + tree.length) % tree.length;
        }
        if (this.audio) this.audio.uiClick();
      }
      const dx = action.dx || 0;
      if (dx !== 0 && (this.skillTreeReturnState === 'hubMenu' || this.skillTreeReturnState === 'town')) {
        const idx = this.classOrder.indexOf(this.selectedClass);
        this.selectedClass = this.classOrder[(idx + dx + this.classOrder.length) % this.classOrder.length];
        this.skillTreeCursor = 0;
        this.skillTreeScrollOffset = 0;
        if (this.audio) this.audio.uiClick();
      }
      return;
    }
    if (action.type === 'inventoryConfirm' || action.type === 'wait') {
      this.tryInvestSkillTreePoint();
    }
  }

  tryInvestSkillTreePoint() {
    if (!this.saveData) return;
    const classKey = this.player?.playerClass || this.selectedClass;
    if (!classKey) return;
    const nodes = getSkillTreeNodes(this);
    if (this.skillTreeCursor >= nodes.length) return;

    const node = nodes[this.skillTreeCursor];
    const investments = this.saveData.skillInvestments[classKey] || {};
    const available = this.saveData.skillPoints[classKey] || 0;

    if (available <= 0) return;
    if (!canInvestSkill(classKey, node.id, investments)) return;

    investSkill(classKey, node.id, investments);
    this.saveData.skillInvestments[classKey] = investments;
    this.saveData.skillPoints[classKey] = available - 1;

    this.treePassiveEffects = resolvePassiveEffects(classKey, investments);
    // mid-run investment: rebuild the tree actives (keeping cooldowns) and hp
    if (this.player && this.player.playerClass === classKey) {
      const saved = Object.fromEntries((this.player.treeActiveSkills || []).map(s => [s.id, s.currentCooldown || 0]));
      this.player.treeActiveSkills = createTreeActiveSkills(classKey, investments, saved);
      updateActiveSkills(this.player);
      recalcPlayerMaxHp(this);
    }
    persistSaveData(this.saveData);
    if (this.audio) this.audio.uiClick();
  }

  // --- Main update loop ---

  update() {
    const action = this.input.consume();

    if (this.state === 'startMenu') {
      this.handleStartMenuAction(action);
      return;
    }
    if (this.state === 'deathSplash') {
      this.handleDeathSplashAction(action);
      return;
    }
    if (this.state === 'deathSaveChoice') {
      this.handleDeathSaveChoiceAction(action);
      return;
    }
    if (this.state === 'postDeathMenu') {
      this.handlePostDeathMenuAction(action);
      return;
    }
    if (this.state === 'victory') {
      this.handleVictoryAction(action);
      return;
    }
    if (this.state === 'town') {
      this.handleTownUpdate(action);
      return;
    }
    if (this.state === 'hubMenu') {
      this.handleHubMenuAction(action);
      return;
    }
    if (this.state === 'hubShop') {
      this.handleHubShopAction(action);
      return;
    }
    if (this.state === 'hubStash') {
      this.handleHubStashAction(action);
      return;
    }
    if (this.state === 'hubAchievements') {
      this.handleHubAchievementsAction(action);
      return;
    }
    if (this.state === 'settings') {
      this.handleSettingsAction(action);
      return;
    }
    if (this.state === 'pauseMenu') {
      this.handlePauseMenuAction(action);
      return;
    }
    if (this.state === 'skillTree') {
      this.handleSkillTreeAction(action);
      return;
    }
    if (this.state !== 'playing') return;
    if (!action) return;

    if (this.mapOpen) {
      if (action.type === 'map' || action.type === 'close') {
        this.toggleMapOverlay();
      }
      return;
    }
    if (this.inventoryOpen) {
      handleInventoryOverlayAction(this, action);
      return;
    }
    if (this.statsOpen) {
      if (action.type === 'stats' || action.type === 'close' || action.type === 'inventoryConfirm') {
        this.toggleStatsOverlay();
      }
      return;
    }

    if (action.type === 'map') {
      this.toggleMapOverlay();
      return;
    }
    if (action.type === 'inventory' || action.type === 'inventoryTab') {
      this.toggleInventoryOverlay();
      return;
    }
    if (action.type === 'stats') {
      this.toggleStatsOverlay();
      return;
    }
    if (action.type === 'close') {
      this.state = 'pauseMenu';
      this.pauseMenuIndex = 0;
      if (this.audio) this.audio.uiClick();
      return;
    }

    const usedSkill = action.type === 'skill' ? this.player.activeSkills[action.slot] || null : null;
    const acted = processPlayerAction(this, action);
    if (!acted) return;

    tickCooldowns(this.player, usedSkill);
    this.player.spendTurn();
    this.turnCount++;
    this.applyNaturalRegen();

    // Skill tree passive regen
    if (this.treePassiveEffects?.passive_regen > 0) {
      this.treeRegenCounter = (this.treeRegenCounter || 0) + 1;
      if (this.treeRegenCounter >= this.treePassiveEffects.passive_regen) {
        this.treeRegenCounter = 0;
        if (this.player.hp < this.player.maxHp) {
          this.player.heal(getRegenAmount(this.player));
        }
      }
    }

    // Tick status effects
    for (const effect of this.player.statusEffects) {
      if (effect.type === 'regeneration') {
        const before = this.player.hp;
        // values below 1 are a fraction of max hp; larger values are flat (legacy items)
        this.player.heal(effect.value < 1 ? getRegenAmount(this.player, effect.value) : effect.value);
        if (this.player.hp > before) {
          this.messageLog.add(`Regeneration heals ${this.player.hp - before} HP.`, this.turnCount);
        }
      }
    }
    this.player.tickStatusEffects();
    // enemy effects (stun, slow) expire on the player's clock
    for (const entity of this.map.entities) {
      if (entity.type === 'enemy' && entity.isAlive()) entity.tickStatusEffects();
    }

    // Run ticks until the player gets another turn
    let safety = 0;
    while (safety++ < 200) {
      const ready = this.turnSystem.tick();
      if (ready.length === 0) continue;

      let playerReady = false;
      for (const entity of ready) {
        if (entity.type === 'player') {
          playerReady = true;
          continue;
        }
        processEnemyTurn(this, entity);
        if (this.state !== 'playing') break;
      }

      if (playerReady || this.state !== 'playing') break;
    }

    if (this.state !== 'playing') return;
    computeFOV(this.map, this.player.position.x, this.player.position.y, FOV_RADIUS);
    this.camera.centerOn(this.player.position.x, this.player.position.y, this.map.width, this.map.height);
    this.runSummary.floorsReached = Math.max(this.runSummary.floorsReached, this.floorNumber);
  }

  // --- Town rendering ---

  drawTown() {
    this.renderer.render({ map: this.townMap, player: null });

    const spriteKey = 'player_' + this.selectedClass;
    const sprite = this.sprites.get(spriteKey);
    if (sprite) {
      const { sx, sy } = this.camera.tileToScreen(this.townPlayerPos.x, this.townPlayerPos.y);
      this.ctx.drawImage(sprite, sx, sy, this.camera.tileSize, this.camera.tileSize);
    }

    if (this.townInteractPrompt) {
      const cx = Math.floor(this.canvas.width / 2);
      const py = this.canvas.height - 100;
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      this.ctx.fillRect(cx - 130, py - 14, 260, 28);
      this.ctx.fillStyle = '#ffd700';
      this.ctx.font = '14px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Enter / Space : Enter Shelter', cx, py + 5);
      this.ctx.textAlign = 'left';
    }

    this.drawTownHUD();
  }

  drawTownHUD() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, w, TOWN_BAR_HEIGHT);
    ctx.fillStyle = '#e0d8c0';
    ctx.font = '14px monospace';
    const classInfo = PLAYER_CLASSES[this.selectedClass];
    const className = classInfo ? classInfo.name : this.selectedClass;
    const lvl = this.saveData?.classLevels?.[this.selectedClass] || 1;
    ctx.fillText(`${className} Lv.${lvl}`, 10, 20);

    const essenceText = `Essence: ${this.saveData?.currency || 0}`;
    ctx.fillStyle = '#ffd700';
    ctx.fillText(essenceText, w - ctx.measureText(essenceText).width - 10, 20);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, h - TOWN_BAR_HEIGHT, w, TOWN_BAR_HEIGHT);
    ctx.fillStyle = '#8a9aaa';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Arrows: Move | ESC: Menu | P: Skills', w / 2, h - 11);
    ctx.textAlign = 'left';
  }

  // --- Main draw dispatcher ---

  draw(nowMs = this.getNowMs()) {
    if (this.state === 'startMenu') {
      drawStartMenu(this);
      return;
    }

    if (this.state === 'deathSaveChoice') {
      drawDeathSaveChoice(this);
      return;
    }

    if (this.state === 'postDeathMenu') {
      drawPostDeathMenu(this);
      return;
    }

    if (this.state === 'victory') {
      drawVictoryScreen(this);
      return;
    }
    if (this.state === 'town') {
      this.drawTown();
      return;
    }
    if (this.state === 'hubMenu') {
      drawHubMenu(this);
      return;
    }
    if (this.state === 'hubShop') {
      drawHubShop(this);
      return;
    }
    if (this.state === 'hubStash') {
      drawHubStash(this);
      return;
    }
    if (this.state === 'hubAchievements') {
      drawHubAchievements(this);
      return;
    }
    if (this.state === 'skillTree') {
      drawSkillTree(this);
      return;
    }

    if (!this.map || !this.player) {
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    this.renderer.render({ map: this.map, player: this.player });
    drawCombatVfx(this, nowMs);
    // Build XP data for HUD
    let xpData = null;
    if (this.player && this.saveData) {
      const ck = this.player.playerClass;
      const lvl = this.saveData.classLevels[ck] || 1;
      const xpVal = this.saveData.classXP[ck] || 0;
      const nextXP = getXPForNextLevel(lvl);
      let prog = null;
      if (nextXP) {
        const prevXP = XP_TABLE[lvl - 1] || 0;
        prog = Math.min(1, (xpVal - prevXP) / (nextXP - prevXP));
      }
      xpData = { level: lvl, progress: prog };
    }

    this.hud.draw(this.player, this.messageLog, getEntityStatsWithEquipment(this.player), this.runMaterials, xpData);

    if (this.state === 'deathSplash') {
      drawDeathSplash(this);
      return;
    }

    if (this.state === 'settings') {
      drawSettingsMenu(this);
      return;
    }
    if (this.state === 'pauseMenu') {
      drawPauseMenu(this);
      return;
    }
    if (this.mapOpen) drawMapOverlay(this);
    if (this.inventoryOpen) drawInventoryOverlay(this);
    if (this.statsOpen) drawStatsOverlay(this);
  }

  // --- Game loop ---

  loop(nowMs = null) {
    const frameNow = typeof nowMs === 'number' ? nowMs : this.getNowMs();
    this.update();
    updateCombatVfx(this, frameNow);
    this.draw(frameNow);
    requestAnimationFrame(nextMs => this.loop(nextMs));
  }
}
