import { PIECE_TYPES, TERRAIN_TYPES } from './Constants.js';

export const BOSSES = {
    floor5: {
        id: 'floor5',
        name: 'The Dark Bishop',
        title: 'Guardian of the Midgame',
        description: 'A powerful bishop commands an army of zealots. The board shifts as the battle unfolds.',
        boardSize: { cols: 8, rows: 8 },
        phases: [
            {
                name: 'Phase 1: The Congregation',
                pieces: [
                    { type: PIECE_TYPES.KING, col: 4, row: 0 },
                    { type: PIECE_TYPES.BISHOP, col: 2, row: 0 },
                    { type: PIECE_TYPES.BISHOP, col: 5, row: 0 },
                    { type: PIECE_TYPES.PAWN, col: 3, row: 1 },
                    { type: PIECE_TYPES.PAWN, col: 5, row: 1 },
                ],
                terrain: [
                    { col: 0, row: 3, terrain: TERRAIN_TYPES.VOID },
                    { col: 7, row: 3, terrain: TERRAIN_TYPES.VOID },
                    { col: 3, row: 3, terrain: TERRAIN_TYPES.ALTAR },
                    { col: 4, row: 3, terrain: TERRAIN_TYPES.ALTAR },
                ],
            },
            {
                name: 'Phase 2: Divine Wrath',
                addPieces: [
                    { type: PIECE_TYPES.BISHOP, col: 0, row: 0 },
                    { type: PIECE_TYPES.KNIGHT, col: 7, row: 0 },
                ],
                addTerrain: [
                    { col: 1, row: 4, terrain: TERRAIN_TYPES.BRAMBLE },
                    { col: 6, row: 4, terrain: TERRAIN_TYPES.BRAMBLE },
                ],
                triggerCondition: 'piecesRemaining',
                triggerValue: 3,
            },
        ],
        goldReward: 40,
        difficulty: 3,
    },
    floor10: {
        id: 'floor10',
        name: 'The Ivory King',
        title: 'Ruler of the Board',
        description: 'The final challenge. A complete chess army stands against you, led by a king who refuses to fall.',
        boardSize: { cols: 10, rows: 10 },
        phases: [
            {
                name: 'Phase 1: Royal Guard',
                pieces: [
                    { type: PIECE_TYPES.KING, col: 5, row: 0 },
                    { type: PIECE_TYPES.QUEEN, col: 4, row: 0 },
                    { type: PIECE_TYPES.ROOK, col: 1, row: 0 },
                    { type: PIECE_TYPES.BISHOP, col: 3, row: 0 },
                    { type: PIECE_TYPES.BISHOP, col: 6, row: 0 },
                    { type: PIECE_TYPES.KNIGHT, col: 2, row: 0 },
                    { type: PIECE_TYPES.KNIGHT, col: 7, row: 0 },
                    { type: PIECE_TYPES.PAWN, col: 3, row: 1 },
                    { type: PIECE_TYPES.PAWN, col: 5, row: 1 },
                    { type: PIECE_TYPES.PAWN, col: 7, row: 1 },
                ],
                terrain: [
                    { col: 0, row: 4, terrain: TERRAIN_TYPES.VOID },
                    { col: 9, row: 4, terrain: TERRAIN_TYPES.VOID },
                    { col: 0, row: 5, terrain: TERRAIN_TYPES.VOID },
                    { col: 9, row: 5, terrain: TERRAIN_TYPES.VOID },
                    { col: 4, row: 4, terrain: TERRAIN_TYPES.FORTRESS },
                    { col: 5, row: 4, terrain: TERRAIN_TYPES.FORTRESS },
                ],
            },
            {
                name: 'Phase 2: Reinforcements',
                addPieces: [
                    { type: PIECE_TYPES.ROOK, col: 8, row: 0 },
                    { type: PIECE_TYPES.PAWN, col: 0, row: 1 },
                ],
                addTerrain: [
                    { col: 2, row: 5, terrain: TERRAIN_TYPES.ICE },
                    { col: 7, row: 5, terrain: TERRAIN_TYPES.ICE },
                ],
                removeTerrain: [
                    { col: 4, row: 4 },
                    { col: 5, row: 4 },
                ],
                triggerCondition: 'piecesRemaining',
                triggerValue: 8,
            },
            {
                name: 'Phase 3: Last Stand',
                addPieces: [
                    { type: PIECE_TYPES.KNIGHT, col: 4, row: 1 },
                ],
                addTerrain: [
                    { col: 3, row: 3, terrain: TERRAIN_TYPES.BRAMBLE },
                    { col: 6, row: 3, terrain: TERRAIN_TYPES.BRAMBLE },
                ],
                triggerCondition: 'piecesRemaining',
                triggerValue: 4,
            },
        ],
        goldReward: 60,
        difficulty: 5,
    },
};

export function getBossForFloor(floor) {
    if (floor === 5) return BOSSES.floor5;
    if (floor === 10) return BOSSES.floor10;
    return null;
}
