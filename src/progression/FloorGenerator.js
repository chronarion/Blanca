import { getFloorConfig } from '../data/FloorData.js';

export class FloorGenerator {
    constructor(rng) {
        this.rng = rng;
    }

    generateFloor(floorNum) {
        const config = getFloorConfig(floorNum);
        const nodes = [];

        if (config.types.boss) {
            nodes.push({
                id: 0,
                type: 'boss',
                floor: floorNum,
                x: 0.5,
                y: 0.5,
                connections: [],
                visited: false,
            });
            return { floor: floorNum, nodes, config };
        }

        const count = config.nodeCount;
        for (let i = 0; i < count; i++) {
            const type = this.rollNodeType(config.types);
            nodes.push({
                id: i,
                type,
                floor: floorNum,
                x: (i + 0.5) / count,
                y: 0.3 + this.rng.random() * 0.4,
                connections: [],
                visited: false,
            });
        }

        // Create connections (branching paths)
        for (let i = 0; i < count; i++) {
            const maxConn = Math.min(2, count - 1);
            const connections = new Set();

            // Connect to at least one neighbor
            if (i < count - 1) connections.add(i + 1);
            if (i > 0 && this.rng.random() < 0.4) connections.add(i - 1);

            // Random extra connection
            if (this.rng.random() < 0.3) {
                const target = this.rng.randomInt(0, count - 1);
                if (target !== i) connections.add(target);
            }

            nodes[i].connections = [...connections];
        }

        return { floor: floorNum, nodes, config };
    }

    rollNodeType(typeWeights) {
        const types = Object.keys(typeWeights);
        const weights = types.map(t => typeWeights[t]);
        return this.rng.weightedChoice(types, weights);
    }

    generateMap(totalFloors = 10) {
        const floors = [];
        for (let i = 1; i <= totalFloors; i++) {
            floors.push(this.generateFloor(i));
        }
        return floors;
    }
}
