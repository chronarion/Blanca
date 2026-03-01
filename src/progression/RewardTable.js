import { PIECE_TYPES } from '../data/Constants.js';
import { getRandomModifier, getModifiersForPiece } from '../data/ModifierData.js';
import { getRandomRelic } from '../data/RelicData.js';

export class RewardTable {
    constructor(rng) {
        this.rng = rng;
    }

    getBattleRewards(floor, isElite) {
        const rewards = { gold: 0, modifier: null, relic: null, recruitOptions: [] };

        rewards.gold = this.rollGold(floor, isElite);

        if (isElite) {
            if (this.rng.random() > 0.5) {
                rewards.modifier = getRandomModifier(this.rng);
            } else {
                rewards.relic = getRandomRelic([], this.rng);
            }
        } else {
            if (this.rng.random() < 0.3) {
                rewards.modifier = getRandomModifier(this.rng);
            }
        }

        rewards.recruitOptions = this.getRecruitOptions(floor);

        return rewards;
    }

    rollGold(floor, isElite) {
        const base = 5 + floor * 3;
        const range = 4 + floor;
        let gold = base + this.rng.randomInt(0, range);
        if (isElite) gold = Math.floor(gold * 1.5);
        return gold;
    }

    getRecruitOptions(floor) {
        const options = [{ type: PIECE_TYPES.PAWN, cost: 0 }];

        if (floor >= 3 && this.rng.random() < 0.5) {
            options.push({ type: this.rng.randomChoice([PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP]), cost: 0 });
        }

        return options;
    }

    getBossRewards(floor) {
        return {
            gold: 20 + floor * 5,
            relic: getRandomRelic([], this.rng),
            modifier: getRandomModifier(this.rng),
            recruitOptions: [
                { type: PIECE_TYPES.PAWN, cost: 0 },
                { type: this.rng.randomChoice([PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK]), cost: 0 },
            ],
        };
    }
}
