export class DifficultyScaler {
    constructor() {
        this.baseAIDifficulty = 1;
    }

    getAIDifficulty(floor) {
        if (floor <= 2) return 1;
        if (floor <= 4) return 2;
        if (floor <= 6) return 3;
        if (floor <= 8) return 4;
        return 5;
    }

    getGoldMultiplier(floor, relics) {
        let mult = 1 + (floor - 1) * 0.1;
        if (relics.some(r => r.id === 'goldBonus')) {
            mult *= 1.5;
        }
        return mult;
    }

    getEliteRewardBonus(floor) {
        return Math.floor(floor * 1.5);
    }
}
