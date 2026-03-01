import { TERRAIN_TYPES } from './Constants.js';

export const TERRAIN_INFO = {
    [TERRAIN_TYPES.FORTRESS]: {
        name: 'Fortress',
        description: "Piece on this square can't be captured",
        color: { light: '#a0c4ff', dark: '#7ba7e0' },
        symbol: '🛡',
    },
    [TERRAIN_TYPES.ICE]: {
        name: 'Ice',
        description: 'Piece that moves here slides one extra square in the same direction',
        color: { light: '#cce5ff', dark: '#99ccee' },
        symbol: '❄',
    },
    [TERRAIN_TYPES.BRAMBLE]: {
        name: 'Bramble',
        description: "Piece that moves here can't move next turn",
        color: { light: '#8bc34a', dark: '#689f38' },
        symbol: '♣',
    },
    [TERRAIN_TYPES.VOID]: {
        name: 'Void',
        description: 'Impassable — no piece can enter',
        color: { light: '#2a2a2a', dark: '#1a1a1a' },
        symbol: '▪',
    },
    [TERRAIN_TYPES.ALTAR]: {
        name: 'Altar',
        description: 'Pawn stepping here promotes immediately',
        color: { light: '#ffd54f', dark: '#ffb300' },
        symbol: '☆',
    },
};

export function getRandomTerrain(rng = Math) {
    const types = [TERRAIN_TYPES.FORTRESS, TERRAIN_TYPES.ICE, TERRAIN_TYPES.BRAMBLE, TERRAIN_TYPES.ALTAR];
    return types[Math.floor(rng.random() * types.length)];
}
