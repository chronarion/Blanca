export const MODIFIER_TYPES = {
    MOVEMENT: 'movement',
    CAPTURE: 'capture',
    DEFENSE: 'defense',
    AURA: 'aura',
    RISK: 'risk',
};

export const RARITY_COLORS = {
    common: '#8a8a8a',
    uncommon: '#4a9e5a',
    rare: '#5880b8',
    legendary: '#c9a84e',
};

export const MODIFIERS = {
    // === MOVEMENT (8) ===
    leapOver: {
        id: 'leapOver',
        name: 'Leap Over',
        description: 'Sliding pieces can jump over one blocking piece in their path',
        shortDescription: 'Jump over 1 blocker',
        category: MODIFIER_TYPES.MOVEMENT,
        rarity: 'rare',
        shopPrice: 15,
        redundantFor: [],
    },
    extraRange: {
        id: 'extraRange',
        name: 'Extended Reach',
        description: 'Sliding moves extend 2 extra squares in each direction',
        shortDescription: '+2 slide range',
        category: MODIFIER_TYPES.MOVEMENT,
        rarity: 'common',
        shopPrice: 8,
        redundantFor: ['queen', 'rook', 'bishop'],
    },
    kingStep: {
        id: 'kingStep',
        name: 'Royal Step',
        description: 'Can also move one square in any direction, like a king',
        shortDescription: '+king moves',
        category: MODIFIER_TYPES.MOVEMENT,
        rarity: 'uncommon',
        shopPrice: 12,
        redundantFor: ['queen', 'king'],
    },
    sidestep: {
        id: 'sidestep',
        name: 'Sidestep',
        description: 'Can move one square left or right along the same row',
        shortDescription: '+1 left/right',
        category: MODIFIER_TYPES.MOVEMENT,
        rarity: 'common',
        shopPrice: 6,
        redundantFor: ['queen', 'rook', 'king'],
    },
    retreat: {
        id: 'retreat',
        name: 'Retreat',
        description: 'Can move one square directly backward',
        shortDescription: '+1 backward',
        category: MODIFIER_TYPES.MOVEMENT,
        rarity: 'common',
        shopPrice: 6,
        redundantFor: ['queen', 'rook', 'king'],
    },
    diagonalSlip: {
        id: 'diagonalSlip',
        name: 'Diagonal Slip',
        description: 'Can move one square diagonally in any direction',
        shortDescription: '+diagonal step',
        category: MODIFIER_TYPES.MOVEMENT,
        rarity: 'common',
        shopPrice: 7,
        redundantFor: ['queen', 'bishop', 'king'],
    },
    charge: {
        id: 'charge',
        name: 'Charge',
        description: 'On first move of battle, sliding range extends by 3 extra squares',
        shortDescription: '+3 range on first move',
        category: MODIFIER_TYPES.MOVEMENT,
        rarity: 'uncommon',
        shopPrice: 10,
        redundantFor: ['queen', 'rook', 'bishop'],
    },
    phasing: {
        id: 'phasing',
        name: 'Phasing',
        description: 'Slides pass through blocking pieces as if they were not there',
        shortDescription: 'Ignore blockers',
        category: MODIFIER_TYPES.MOVEMENT,
        rarity: 'legendary',
        shopPrice: 22,
        redundantFor: [],
    },

    // === CAPTURE (4) ===
    forwardCapture: {
        id: 'forwardCapture',
        name: 'Pike',
        description: 'Can capture one square directly forward',
        shortDescription: '+forward capture',
        category: MODIFIER_TYPES.CAPTURE,
        rarity: 'common',
        shopPrice: 8,
        redundantFor: ['queen', 'rook'],
    },
    doubleCapture: {
        id: 'doubleCapture',
        name: 'Zealous Pursuit',
        description: 'After capturing, this piece can move again',
        shortDescription: 'Extra move on capture',
        category: MODIFIER_TYPES.CAPTURE,
        rarity: 'rare',
        shopPrice: 18,
        redundantFor: [],
    },
    captureChain: {
        id: 'captureChain',
        name: 'Chain Strike',
        description: 'After capturing, if another capture is immediately available, move again',
        shortDescription: 'Chain captures',
        category: MODIFIER_TYPES.CAPTURE,
        rarity: 'uncommon',
        shopPrice: 14,
        redundantFor: [],
    },
    captureRetreat: {
        id: 'captureRetreat',
        name: 'Hit and Run',
        description: 'After capturing, return to starting square',
        shortDescription: 'Return after capture',
        category: MODIFIER_TYPES.CAPTURE,
        rarity: 'uncommon',
        shopPrice: 12,
        redundantFor: [],
    },

    // === DEFENSE (7) ===
    firstTurnShield: {
        id: 'firstTurnShield',
        name: 'Opening Guard',
        description: 'Cannot be captured during the first 2 turns of battle',
        shortDescription: 'Immune turns 1-2',
        category: MODIFIER_TYPES.DEFENSE,
        rarity: 'common',
        shopPrice: 5,
        redundantFor: [],
    },
    flankShield: {
        id: 'flankShield',
        name: 'Flanking Shield',
        description: 'Cannot be captured from the side (same row)',
        shortDescription: 'Side-immune',
        category: MODIFIER_TYPES.DEFENSE,
        rarity: 'uncommon',
        shopPrice: 14,
        redundantFor: [],
    },
    rearShield: {
        id: 'rearShield',
        name: 'Rear Guard',
        description: 'Cannot be captured from behind',
        shortDescription: 'Back-immune',
        category: MODIFIER_TYPES.DEFENSE,
        rarity: 'uncommon',
        shopPrice: 12,
        redundantFor: [],
    },
    adjacencyShield: {
        id: 'adjacencyShield',
        name: 'Formation Guard',
        description: 'Cannot be captured while adjacent to a friendly piece',
        shortDescription: 'Immune near allies',
        category: MODIFIER_TYPES.DEFENSE,
        rarity: 'rare',
        shopPrice: 16,
        redundantFor: [],
    },
    lastStand: {
        id: 'lastStand',
        name: 'Last Stand',
        description: 'When this is the last non-king piece, immune for 3 turns',
        shortDescription: 'Immune as last piece',
        category: MODIFIER_TYPES.DEFENSE,
        rarity: 'rare',
        shopPrice: 14,
        redundantFor: [],
    },
    anchored: {
        id: 'anchored',
        name: 'Anchored',
        description: 'Cannot be captured, but limited to 2 squares of movement',
        shortDescription: 'Immovable fortress',
        category: MODIFIER_TYPES.DEFENSE,
        rarity: 'legendary',
        shopPrice: 20,
        redundantFor: [],
    },
    gamblersFate: {
        id: 'gamblersFate',
        name: "Gambler's Fate",
        description: '50% chance to survive being captured',
        shortDescription: '50% dodge capture',
        category: MODIFIER_TYPES.DEFENSE,
        rarity: 'rare',
        shopPrice: 16,
        redundantFor: [],
    },

    // === AURA (5) ===
    inspire: {
        id: 'inspire',
        name: 'Inspire',
        description: 'Adjacent friendly pieces gain +1 sliding range',
        shortDescription: 'Allies +1 range',
        category: MODIFIER_TYPES.AURA,
        rarity: 'rare',
        shopPrice: 16,
        redundantFor: [],
    },
    intimidate: {
        id: 'intimidate',
        name: 'Intimidate',
        description: 'Adjacent enemy pieces lose 1 sliding range (minimum 1)',
        shortDescription: 'Enemies -1 range',
        category: MODIFIER_TYPES.AURA,
        rarity: 'uncommon',
        shopPrice: 12,
        redundantFor: [],
    },
    guardian: {
        id: 'guardian',
        name: 'Guardian',
        description: "Adjacent friendly pieces can't be captured from this piece's direction",
        shortDescription: 'Shield allies from side',
        category: MODIFIER_TYPES.AURA,
        rarity: 'rare',
        shopPrice: 16,
        redundantFor: [],
    },
    decoy: {
        id: 'decoy',
        name: 'Decoy',
        description: 'Enemy AI prioritizes capturing this piece over others',
        shortDescription: 'Draws enemy fire',
        category: MODIFIER_TYPES.AURA,
        rarity: 'uncommon',
        shopPrice: 10,
        redundantFor: [],
    },
    rally: {
        id: 'rally',
        name: 'Rally Cry',
        description: 'When this piece captures, all friendlies gain +1 range next turn',
        shortDescription: 'Capture buffs team',
        category: MODIFIER_TYPES.AURA,
        rarity: 'legendary',
        shopPrice: 20,
        redundantFor: [],
    },

    // === RISK/REWARD (4) ===
    glasscannon: {
        id: 'glasscannon',
        name: 'Glass Cannon',
        description: '+3 sliding range, but all protections on this piece are bypassed',
        shortDescription: '+3 range, no defense',
        category: MODIFIER_TYPES.RISK,
        rarity: 'uncommon',
        shopPrice: 10,
        redundantFor: ['queen', 'rook', 'bishop'],
    },
    berserker: {
        id: 'berserker',
        name: 'Berserker',
        description: 'Gains +1 sliding range for each capture made this battle',
        shortDescription: '+range per kill',
        category: MODIFIER_TYPES.RISK,
        rarity: 'rare',
        shopPrice: 16,
        redundantFor: ['queen', 'rook', 'bishop'],
    },
    explosiveCapture: {
        id: 'explosiveCapture',
        name: 'Explosive Capture',
        description: 'When capturing, also removes all adjacent enemy pieces',
        shortDescription: 'AoE on capture',
        category: MODIFIER_TYPES.RISK,
        rarity: 'legendary',
        shopPrice: 24,
        redundantFor: [],
    },
    rangedCapture: {
        id: 'rangedCapture',
        name: 'Ranged Strike',
        description: 'Can capture at range without moving to the target square',
        shortDescription: 'Capture at distance',
        category: MODIFIER_TYPES.RISK,
        rarity: 'legendary',
        shopPrice: 22,
        redundantFor: [],
    },
};

const RARITY_WEIGHTS = { common: 50, uncommon: 30, rare: 15, legendary: 5 };

export function getModifiersByRarity(rarity) {
    return Object.values(MODIFIERS).filter(m => m.rarity === rarity);
}

export function getModifierById(id) {
    return MODIFIERS[id] || null;
}

export function getRandomModifier(rng = Math) {
    const all = Object.values(MODIFIERS);
    return all[Math.floor(rng.random() * all.length)];
}

export function getUpgradePackChoices(rng, excludeIds = [], count = 3, rosterTypes = []) {
    // Filter out excluded IDs and modifiers redundant for entire roster
    const nonKingTypes = rosterTypes.filter(t => t !== 'king');
    const pool = Object.values(MODIFIERS).filter(m => {
        if (excludeIds.includes(m.id)) return false;
        // Skip modifiers redundant for ALL non-king roster pieces
        if (m.redundantFor && m.redundantFor.length > 0 && nonKingTypes.length > 0) {
            if (nonKingTypes.every(t => m.redundantFor.includes(t))) return false;
        }
        return true;
    });
    if (pool.length === 0) return [];

    const totalWeight = Object.entries(RARITY_WEIGHTS).reduce((sum, [rarity, w]) => {
        return sum + (pool.some(m => m.rarity === rarity) ? w : 0);
    }, 0);

    const choices = [];
    const used = new Set();

    for (let i = 0; i < count && used.size < pool.length; i++) {
        let roll = rng.random() * totalWeight;
        let selectedRarity = 'common';

        for (const [rarity, w] of Object.entries(RARITY_WEIGHTS)) {
            if (!pool.some(m => m.rarity === rarity && !used.has(m.id))) continue;
            roll -= w;
            if (roll <= 0) {
                selectedRarity = rarity;
                break;
            }
        }

        const candidates = pool.filter(m => m.rarity === selectedRarity && !used.has(m.id));
        if (candidates.length === 0) {
            // Fallback to any unused modifier
            const fallback = pool.filter(m => !used.has(m.id));
            if (fallback.length === 0) break;
            const pick = fallback[Math.floor(rng.random() * fallback.length)];
            choices.push(pick);
            used.add(pick.id);
        } else {
            const pick = candidates[Math.floor(rng.random() * candidates.length)];
            choices.push(pick);
            used.add(pick.id);
        }
    }

    return choices;
}
