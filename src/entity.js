import { ENERGY_THRESHOLD } from './constants.js';

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
    this.activeBlessings = [];
    this.statusEffects = [];
  }

  gainEnergy() {
    this.energy += this.speed;
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
}
