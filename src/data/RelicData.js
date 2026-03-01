export const RELICS = {
    freeMove: {
        id: 'freeMove',
        name: 'Initiative Crown',
        description: 'Start each battle with a free move',
        rarity: 'uncommon',
        shopPrice: 20,
    },
    captureStreak: {
        id: 'captureStreak',
        name: 'Bloodthirst Amulet',
        description: 'Capturing 3 pieces in a row grants an extra turn',
        rarity: 'rare',
        shopPrice: 30,
    },
    earlyPromotion: {
        id: 'earlyPromotion',
        name: 'Fast Track Banner',
        description: 'Pawns promote one rank earlier',
        rarity: 'uncommon',
        shopPrice: 18,
    },
    pawnForwardCapture: {
        id: 'pawnForwardCapture',
        name: "Spearmaster's Manual",
        description: 'All pawns can capture forward',
        rarity: 'common',
        shopPrice: 12,
    },
    extraPieceOnPromote: {
        id: 'extraPieceOnPromote',
        name: 'Recruitment Scroll',
        description: 'Gain an extra pawn when you promote',
        rarity: 'rare',
        shopPrice: 22,
    },
    enemySlowed: {
        id: 'enemySlowed',
        name: 'Leaden Crown',
        description: 'Enemy king can only move every other turn',
        rarity: 'common',
        shopPrice: 8,
    },
    goldBonus: {
        id: 'goldBonus',
        name: "Merchant's Purse",
        description: 'Earn 50% more gold from battles',
        rarity: 'uncommon',
        shopPrice: 15,
    },
    healingRest: {
        id: 'healingRest',
        name: 'Sanctuary Bell',
        description: 'Rest nodes recruit a knight instead of a pawn',
        rarity: 'rare',
        shopPrice: 25,
    },
    shieldStart: {
        id: 'shieldStart',
        name: 'Vanguard Shield',
        description: 'Your front-row pawns have first-turn protection at battle start',
        rarity: 'uncommon',
        shopPrice: 14,
    },
    terrainSight: {
        id: 'terrainSight',
        name: 'Cartographer\'s Lens',
        description: 'See terrain before choosing battle path',
        rarity: 'common',
        shopPrice: 10,
    },
};

export function getRelicsByRarity(rarity) {
    return Object.values(RELICS).filter(r => r.rarity === rarity);
}

export function getRandomRelic(ownedRelicIds = [], rng = Math) {
    const available = Object.values(RELICS).filter(r => !ownedRelicIds.includes(r.id));
    if (available.length === 0) return null;
    return available[Math.floor(rng.random() * available.length)];
}
