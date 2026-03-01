import { PIECE_TYPES } from './Constants.js';

export const ARMIES = {
    standard: {
        id: 'standard',
        name: 'Standard',
        description: 'A full chess army',
        pieces: [
            { type: PIECE_TYPES.KING },
            { type: PIECE_TYPES.QUEEN },
            { type: PIECE_TYPES.ROOK },
            { type: PIECE_TYPES.ROOK },
            { type: PIECE_TYPES.BISHOP },
            { type: PIECE_TYPES.BISHOP },
            { type: PIECE_TYPES.KNIGHT },
            { type: PIECE_TYPES.KNIGHT },
            { type: PIECE_TYPES.PAWN },
            { type: PIECE_TYPES.PAWN },
            { type: PIECE_TYPES.PAWN },
            { type: PIECE_TYPES.PAWN },
            { type: PIECE_TYPES.PAWN },
            { type: PIECE_TYPES.PAWN },
            { type: PIECE_TYPES.PAWN },
            { type: PIECE_TYPES.PAWN },
        ],
        ability: null,
        color: '#c9a84e',
    },
};

export function getArmyList() {
    return Object.values(ARMIES);
}
