import { PIECE_TYPES } from '../data/Constants.js';
import { SHOP_PRICES } from '../data/PieceData.js';
import { getRandomModifier } from '../data/ModifierData.js';
import { getRandomRelic } from '../data/RelicData.js';

export class Shop {
    constructor(rng, eventBus) {
        this.rng = rng;
        this.eventBus = eventBus;
        this.items = [];
    }

    generate(floor, ownedRelicIds = []) {
        this.items = [];

        // 2-3 piece options
        const pieceTypes = [PIECE_TYPES.PAWN, PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK, PIECE_TYPES.QUEEN];
        const shuffled = this.rng.shuffle(pieceTypes);
        const pieceCount = this.rng.randomInt(2, 3);
        for (let i = 0; i < pieceCount; i++) {
            const type = shuffled[i];
            this.items.push({
                category: 'piece',
                type,
                price: SHOP_PRICES[type] || 10,
                name: type.charAt(0).toUpperCase() + type.slice(1),
                description: `Recruit a ${type} to your army`,
            });
        }

        // 1-2 modifiers
        const modCount = this.rng.randomInt(1, 2);
        for (let i = 0; i < modCount; i++) {
            const mod = getRandomModifier(this.rng);
            if (mod && !this.items.some(it => it.id === mod.id)) {
                this.items.push({
                    category: 'modifier',
                    id: mod.id,
                    price: mod.shopPrice,
                    name: mod.name,
                    description: mod.description,
                    rarity: mod.rarity,
                    modifier: mod,
                });
            }
        }

        // 1 relic (if available)
        const relic = getRandomRelic(ownedRelicIds, this.rng);
        if (relic) {
            this.items.push({
                category: 'relic',
                id: relic.id,
                price: relic.shopPrice,
                name: relic.name,
                description: relic.description,
                relic,
            });
        }

        return this.items;
    }

    canAfford(item, gold) {
        return gold >= item.price;
    }

    purchase(item, runManager) {
        if (!this.canAfford(item, runManager.gold)) return false;

        runManager.gold -= item.price;

        switch (item.category) {
            case 'piece':
                runManager.recruitPiece(item.type);
                break;
            case 'modifier':
                // Returns the modifier to be assigned to a piece
                this.eventBus.emit('modifierPurchased', { modifier: item.modifier });
                break;
            case 'relic':
                runManager.addRelic(item.relic);
                break;
        }

        // Remove from shop
        const idx = this.items.indexOf(item);
        if (idx !== -1) this.items.splice(idx, 1);

        this.eventBus.emit('shopPurchase', { item });
        return true;
    }
}
