import { getFloorConfig } from '../data/FloorData.js';

export class FloorGenerator {
    constructor(rng) {
        this.rng = rng;
    }

    generateFloor(floorNum) {
        const config = getFloorConfig(floorNum);

        if (config.types.boss) {
            const nodes = [{
                id: 0,
                type: 'boss',
                floor: floorNum,
                layer: 0,
                layerIndex: 0,
                x: 0.5,
                y: 0.5,
                connections: [],
                visited: false,
            }];
            return { floor: floorNum, nodes, config, layers: 1 };
        }

        // Generate layered branching map
        const layerCount = config.nodeCount;
        const nodesPerLayer = config.paths || 2;
        const nodes = [];
        let id = 0;

        // Create layers of nodes
        const layers = [];
        for (let l = 0; l < layerCount; l++) {
            const layer = [];
            // First and last layers can have fewer nodes
            let count;
            if (l === 0) count = Math.min(nodesPerLayer, 2);
            else if (l === layerCount - 1) count = Math.min(nodesPerLayer, 2);
            else count = nodesPerLayer;

            for (let i = 0; i < count; i++) {
                const type = this.rollNodeType(config.types);
                const node = {
                    id: id++,
                    type,
                    floor: floorNum,
                    layer: l,
                    layerIndex: i,
                    x: (l + 0.5) / layerCount,
                    y: count === 1 ? 0.5 : (i + 0.5) / count,
                    connections: [],
                    visited: false,
                };
                layer.push(node);
                nodes.push(node);
            }
            layers.push(layer);
        }

        // Create forward connections between adjacent layers
        for (let l = 0; l < layers.length - 1; l++) {
            const current = layers[l];
            const next = layers[l + 1];

            // Ensure every node has at least one forward connection
            for (const node of current) {
                // Connect to the closest node in the next layer
                const closest = next.reduce((best, n) => {
                    const dist = Math.abs(node.layerIndex / current.length - n.layerIndex / next.length);
                    const bestDist = Math.abs(node.layerIndex / current.length - best.layerIndex / next.length);
                    return dist < bestDist ? n : best;
                }, next[0]);
                if (!node.connections.includes(closest.id)) {
                    node.connections.push(closest.id);
                }

                // Chance to connect to a second node in next layer (branching)
                if (next.length > 1 && this.rng.random() < 0.5) {
                    const other = next.find(n => n.id !== closest.id);
                    if (other && !node.connections.includes(other.id)) {
                        node.connections.push(other.id);
                    }
                }
            }

            // Ensure every next-layer node has at least one incoming connection
            for (const nextNode of next) {
                const hasIncoming = current.some(n => n.connections.includes(nextNode.id));
                if (!hasIncoming) {
                    // Connect from the closest current-layer node
                    const closest = current.reduce((best, n) => {
                        const dist = Math.abs(n.layerIndex / current.length - nextNode.layerIndex / next.length);
                        const bestDist = Math.abs(best.layerIndex / current.length - nextNode.layerIndex / next.length);
                        return dist < bestDist ? n : best;
                    }, current[0]);
                    closest.connections.push(nextNode.id);
                }
            }
        }

        return { floor: floorNum, nodes, config, layers: layerCount };
    }

    rollNodeType(typeWeights) {
        const types = Object.keys(typeWeights).filter(t => t !== 'boss');
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
