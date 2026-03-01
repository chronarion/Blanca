export class SeededRNG {
    constructor(seed) {
        this.seed = seed;
        this.state = seed;
    }

    next() {
        this.state = (this.state * 1664525 + 1013904223) & 0xFFFFFFFF;
        return (this.state >>> 0) / 0xFFFFFFFF;
    }

    random() {
        return this.next();
    }

    randomInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    randomChoice(arr) {
        return arr[Math.floor(this.next() * arr.length)];
    }

    shuffle(arr) {
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    weightedChoice(items, weights) {
        const total = weights.reduce((a, b) => a + b, 0);
        let roll = this.next() * total;
        for (let i = 0; i < items.length; i++) {
            roll -= weights[i];
            if (roll <= 0) return items[i];
        }
        return items[items.length - 1];
    }

    static generateSeed() {
        return Math.floor(Math.random() * 0xFFFFFFFF);
    }
}
