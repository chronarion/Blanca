export const MODIFIER_TYPES = {
    MOVEMENT: 'movement',
    CAPTURE: 'capture',
    PROTECTION: 'protection',
    UNIQUE: 'unique',
};

export const MODIFIERS = {
    // Movement modifiers
    knightKingMove: {
        id: 'knightKingMove',
        name: 'Royal Step',
        description: 'This knight can also move like a king (one square any direction)',
        type: MODIFIER_TYPES.MOVEMENT,
        rarity: 'uncommon',
        validPieces: ['knight'],
        shopPrice: 12,
    },
    rookExtraRange: {
        id: 'rookExtraRange',
        name: 'Extended Reach',
        description: 'This rook moves up to 2 extra squares',
        type: MODIFIER_TYPES.MOVEMENT,
        rarity: 'common',
        validPieces: ['rook'],
        shopPrice: 10,
    },
    pawnDiagonalMove: {
        id: 'pawnDiagonalMove',
        name: 'Sidestep',
        description: 'This pawn can move one square diagonally forward without capturing',
        type: MODIFIER_TYPES.MOVEMENT,
        rarity: 'common',
        validPieces: ['pawn'],
        shopPrice: 6,
    },
    bishopLeap: {
        id: 'bishopLeap',
        name: 'Holy Leap',
        description: 'This bishop can jump over one piece in its path',
        type: MODIFIER_TYPES.MOVEMENT,
        rarity: 'rare',
        validPieces: ['bishop'],
        shopPrice: 15,
    },

    // Capture modifiers
    bishopDoubleCapture: {
        id: 'bishopDoubleCapture',
        name: 'Zealous Pursuit',
        description: 'After capturing, this bishop can move again',
        type: MODIFIER_TYPES.CAPTURE,
        rarity: 'rare',
        validPieces: ['bishop'],
        shopPrice: 18,
    },
    knightRangedCapture: {
        id: 'knightRangedCapture',
        name: 'Lance Strike',
        description: 'This knight can capture without moving to the target square',
        type: MODIFIER_TYPES.CAPTURE,
        rarity: 'legendary',
        validPieces: ['knight'],
        shopPrice: 25,
    },
    pawnForwardCapture: {
        id: 'pawnForwardCapture',
        name: 'Pike',
        description: 'This pawn can capture forward',
        type: MODIFIER_TYPES.CAPTURE,
        rarity: 'common',
        validPieces: ['pawn'],
        shopPrice: 8,
    },

    // Protection modifiers
    sideProtection: {
        id: 'sideProtection',
        name: 'Flanking Shield',
        description: "This rook can't be captured from the side",
        type: MODIFIER_TYPES.PROTECTION,
        rarity: 'uncommon',
        validPieces: ['rook'],
        shopPrice: 14,
    },
    firstTurnProtection: {
        id: 'firstTurnProtection',
        name: 'Opening Guard',
        description: "This pawn can't be captured on its first turn",
        type: MODIFIER_TYPES.PROTECTION,
        rarity: 'common',
        validPieces: ['pawn'],
        shopPrice: 5,
    },

    // Unique modifiers
    queenTrail: {
        id: 'queenTrail',
        name: 'Scorched Path',
        description: 'This queen leaves a blocked square behind when it moves',
        type: MODIFIER_TYPES.UNIQUE,
        rarity: 'legendary',
        validPieces: ['queen'],
        shopPrice: 20,
    },
    kingInspire: {
        id: 'kingInspire',
        name: 'Royal Inspiration',
        description: 'Friendly pieces adjacent to this king gain +1 move range',
        type: MODIFIER_TYPES.UNIQUE,
        rarity: 'rare',
        validPieces: ['king'],
        shopPrice: 16,
    },
};

export function getModifiersByRarity(rarity) {
    return Object.values(MODIFIERS).filter(m => m.rarity === rarity);
}

export function getModifiersForPiece(pieceType) {
    return Object.values(MODIFIERS).filter(m => m.validPieces.includes(pieceType));
}

export function getRandomModifier(rng = Math) {
    const all = Object.values(MODIFIERS);
    return all[Math.floor(rng.random() * all.length)];
}
