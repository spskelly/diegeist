import { ENERGY_THRESHOLD, SKILL_SLOT_COUNT } from './constants.js';

export class Entity {
  constructor({ id, type, x, y, stats, maxHp, speed, behavior = null, name = '' }) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.position = { x, y };
    this.stats = { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, LCK: 0, ...stats };
    this.hp = maxHp;
    this.maxHp = maxHp;
    this.speed = speed;
    this.energy = 0;
    this.behavior = behavior;
    this.equipment = { head: null, torso: null, legs: null, leftHand: null, rightHand: null, accessory1: null, accessory2: null };
    this.inventory = [];
    this.belt = [null, null, null];
    this.activeSkills = [];
    this.skillSlotBindings = new Array(SKILL_SLOT_COUNT).fill(null);
    this.treeActiveSkills = [];
    this.classSkillCooldown = 0;
    this.activeBlessings = [];
    this.statusEffects = [];
  }

  // slowed enemies (war shout, caltrops) gain energy more slowly
  getEffectiveSpeed() {
    const slow = this.hasStatusEffect('slowed');
    return slow ? Math.max(10, Math.round(this.speed * (1 - slow.value))) : this.speed;
  }

  gainEnergy() {
    this.energy += this.getEffectiveSpeed();
  }

  isReady() {
    return this.energy >= ENERGY_THRESHOLD;
  }

  spendTurn() {
    this.energy -= ENERGY_THRESHOLD;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  isAlive() {
    return this.hp > 0;
  }

  moveTo(x, y) {
    this.position.x = x;
    this.position.y = y;
  }

  addStatusEffect(effect) {
    // extra fields (e.g. defenseReduction on berserk) ride along with the effect
    const { type, duration, value, ...extra } = effect;
    this.statusEffects = this.statusEffects.filter(e => e.type !== type);
    this.statusEffects.push({ ...extra, type, turnsRemaining: duration, value });
  }

  hasStatusEffect(type) {
    return this.statusEffects.find(e => e.type === type) || null;
  }

  tickStatusEffects() {
    this.statusEffects = this.statusEffects.filter(e => {
      e.turnsRemaining--;
      return e.turnsRemaining > 0;
    });
  }
}
