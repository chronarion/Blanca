export const FLOOR_CONFIG = [
    { floor: 1, difficulty: 1, nodeCount: 3, paths: 2, types: { battle: 0.6, event: 0.2, rest: 0.2 } },
    { floor: 2, difficulty: 1, nodeCount: 3, paths: 2, types: { battle: 0.5, event: 0.2, shop: 0.15, rest: 0.15 } },
    { floor: 3, difficulty: 2, nodeCount: 4, paths: 2, types: { battle: 0.55, elite: 0.1, event: 0.1, shop: 0.15, rest: 0.1 } },
    { floor: 4, difficulty: 2, nodeCount: 4, paths: 3, types: { battle: 0.5, elite: 0.15, event: 0.1, shop: 0.15, rest: 0.1 } },
    { floor: 5, difficulty: 3, nodeCount: 1, paths: 1, types: { boss: 1.0 } },
    { floor: 6, difficulty: 3, nodeCount: 3, paths: 2, types: { battle: 0.5, event: 0.2, shop: 0.15, rest: 0.15 } },
    { floor: 7, difficulty: 3, nodeCount: 4, paths: 2, types: { battle: 0.5, elite: 0.15, event: 0.1, shop: 0.15, rest: 0.1 } },
    { floor: 8, difficulty: 4, nodeCount: 4, paths: 3, types: { battle: 0.45, elite: 0.2, event: 0.1, shop: 0.15, rest: 0.1 } },
    { floor: 9, difficulty: 4, nodeCount: 3, paths: 2, types: { battle: 0.4, elite: 0.2, shop: 0.2, rest: 0.2 } },
    { floor: 10, difficulty: 5, nodeCount: 1, paths: 1, types: { boss: 1.0 } },
];

export function getFloorConfig(floor) {
    return FLOOR_CONFIG[floor - 1] || FLOOR_CONFIG[0];
}
