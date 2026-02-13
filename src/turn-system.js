export class TurnSystem {
  constructor() {
    this.entities = [];
  }

  addEntity(entity) {
    this.entities.push(entity);
  }

  removeEntity(id) {
    this.entities = this.entities.filter(e => e.id !== id);
  }

  tick() {
    const ready = [];
    for (const entity of this.entities) {
      if (!entity.isAlive()) continue;
      entity.gainEnergy();
      if (entity.isReady()) {
        ready.push(entity);
      }
    }
    ready.sort((a, b) => b.energy - a.energy);
    return ready;
  }
}
