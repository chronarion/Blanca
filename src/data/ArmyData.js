import { PIECE_TYPES } from './Constants.js';

export const ARMIES = {
    pawnsGambit: {
        id: 'pawnsGambit',
        name: "The Pawns' Gambit",
        description: 'Pawns promote one rank earlier (rank 7 instead of 8)',
        pieces: [
            { type: PIECE_TYPES.KING },
            { type: PIECE_TYPES.PAWN },
            { type: PIECE_TYPES.PAWN },
            { type: PIECE_TYPES.PAWN },
            { type: PIECE_TYPES.PAWN },
            { type: PIECE_TYPES.PAWN },
        ],
        ability: 'earlyPromotion',
        color: '#e8d44d',
    },
    knightErrant: {
        id: 'knightErrant',
        name: 'Knight Errant',
        description: 'Knights can move again after capturing (once per turn)',
        pieces: [
            { type: PIECE_TYPES.KING },
            { type: PIECE_TYPES.KNIGHT },
            { type: PIECE_TYPES.KNIGHT },
            { type: PIECE_TYPES.PAWN },
        ],
        ability: 'knightDoubleCapture',
        color: '#4dabf7',
    },
    bishopsDiocese: {
        id: 'bishopsDiocese',
        name: "The Bishop's Diocese",
        description: 'Bishops can move through one friendly piece',
        pieces: [
            { type: PIECE_TYPES.KING },
            { type: PIECE_TYPES.BISHOP },
            { type: PIECE_TYPES.BISHOP },
            { type: PIECE_TYPES.PAWN },
        ],
        ability: 'bishopPhase',
        color: '#9775fa',
    },
    rooksFortress: {
        id: 'rooksFortress',
        name: "Rook's Fortress",
        description: "Your rooks can't be captured on the first turn of each battle",
        pieces: [
            { type: PIECE_TYPES.KING },
            { type: PIECE_TYPES.ROOK },
            { type: PIECE_TYPES.PAWN },
            { type: PIECE_TYPES.PAWN },
        ],
        ability: 'rookShield',
        color: '#ff6b6b',
    },
    queensCourt: {
        id: 'queensCourt',
        name: "The Queen's Court",
        description: 'Queen splits into Bishop + Rook on death instead of dying',
        pieces: [
            { type: PIECE_TYPES.KING },
            { type: PIECE_TYPES.QUEEN },
        ],
        ability: 'queenSplit',
        color: '#ffd43b',
    },
};

export function getArmyList() {
    return Object.values(ARMIES);
}
