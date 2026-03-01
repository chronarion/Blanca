import { PIECE_TYPES } from './Constants.js';

export const PIECE_VALUES = {
    [PIECE_TYPES.PAWN]: 1,
    [PIECE_TYPES.KNIGHT]: 3,
    [PIECE_TYPES.BISHOP]: 3,
    [PIECE_TYPES.ROOK]: 5,
    [PIECE_TYPES.QUEEN]: 9,
    [PIECE_TYPES.KING]: 100,
};

export const PIECE_NAMES = {
    [PIECE_TYPES.PAWN]: 'Pawn',
    [PIECE_TYPES.KNIGHT]: 'Knight',
    [PIECE_TYPES.BISHOP]: 'Bishop',
    [PIECE_TYPES.ROOK]: 'Rook',
    [PIECE_TYPES.QUEEN]: 'Queen',
    [PIECE_TYPES.KING]: 'King',
};

export const PIECE_SYMBOLS = {
    [PIECE_TYPES.PAWN]: 'P',
    [PIECE_TYPES.KNIGHT]: 'N',
    [PIECE_TYPES.BISHOP]: 'B',
    [PIECE_TYPES.ROOK]: 'R',
    [PIECE_TYPES.QUEEN]: 'Q',
    [PIECE_TYPES.KING]: 'K',
};

export const SHOP_PRICES = {
    [PIECE_TYPES.PAWN]: 5,
    [PIECE_TYPES.KNIGHT]: 15,
    [PIECE_TYPES.BISHOP]: 15,
    [PIECE_TYPES.ROOK]: 20,
    [PIECE_TYPES.QUEEN]: 35,
};
