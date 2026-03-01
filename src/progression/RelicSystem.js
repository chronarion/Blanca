import { RELICS, getRandomRelic } from '../data/RelicData.js';

export class RelicSystem {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.ownedRelics = [];
    }

    addRelic(relic) {
        if (this.hasRelic(relic.id)) return false;
        this.ownedRelics.push({ ...relic });
        this.eventBus.emit('relicGained', { relic });
        return true;
    }

    removeRelic(relicId) {
        const idx = this.ownedRelics.findIndex(r => r.id === relicId);
        if (idx === -1) return false;
        const removed = this.ownedRelics.splice(idx, 1)[0];
        this.eventBus.emit('relicLost', { relic: removed });
        return true;
    }

    hasRelic(relicId) {
        return this.ownedRelics.some(r => r.id === relicId);
    }

    getRelic(relicId) {
        return this.ownedRelics.find(r => r.id === relicId);
    }

    getRandomReward(rng = Math) {
        const ownedIds = this.ownedRelics.map(r => r.id);
        return getRandomRelic(ownedIds, rng);
    }

    getShopOfferings(count = 3, rng = Math) {
        const ownedIds = this.ownedRelics.map(r => r.id);
        const available = Object.values(RELICS).filter(r => !ownedIds.includes(r.id));
        const shuffled = [...available].sort(() => rng.random() - 0.5);
        return shuffled.slice(0, count);
    }

    serialize() {
        return this.ownedRelics.map(r => ({ ...r }));
    }

    deserialize(data) {
        this.ownedRelics = data.map(r => ({ ...r }));
    }
}
