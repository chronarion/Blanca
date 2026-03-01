import { PIECE_TYPES } from './Constants.js';

export const EVENTS = {
    mysteriousAltar: {
        id: 'mysteriousAltar',
        title: 'Mysterious Altar',
        description: 'You find a glowing altar in the ruins. An ancient voice whispers: "Sacrifice to gain power."',
        choices: [
            {
                text: 'Sacrifice a pawn for a random relic',
                effect: 'sacrificePawnForRelic',
                requirement: { minPawns: 1 },
            },
            {
                text: 'Leave it alone',
                effect: 'none',
            },
        ],
    },
    wanderingKnight: {
        id: 'wanderingKnight',
        title: 'Wandering Knight',
        description: 'A lone knight offers to join your cause — for a price.',
        choices: [
            {
                text: 'Pay 15 gold to recruit the knight',
                effect: 'buyKnight',
                requirement: { minGold: 15 },
            },
            {
                text: 'Challenge the knight — win and they join for free',
                effect: 'knightChallenge',
            },
            {
                text: 'Decline',
                effect: 'none',
            },
        ],
    },
    forgottenArmory: {
        id: 'forgottenArmory',
        title: 'Forgotten Armory',
        description: 'Old weapon racks line the walls. Some still hold equipment in usable condition.',
        choices: [
            {
                text: 'Take a random modifier for a piece',
                effect: 'randomModifier',
            },
            {
                text: 'Search carefully for gold (10-20)',
                effect: 'findGold',
            },
        ],
    },
    cursedMirror: {
        id: 'cursedMirror',
        title: 'Cursed Mirror',
        description: 'A dark mirror shows a twisted reflection. Power radiates from it, but at what cost?',
        choices: [
            {
                text: 'Touch the mirror — upgrade a random piece but lose 1 pawn',
                effect: 'mirrorUpgrade',
                requirement: { minPawns: 1 },
            },
            {
                text: 'Smash the mirror — gain 12 gold',
                effect: 'smashMirrorGold',
            },
            {
                text: 'Walk away',
                effect: 'none',
            },
        ],
    },
    campfire: {
        id: 'campfire',
        title: 'Campfire Rest',
        description: 'Your army finds a sheltered spot to rest. The fire crackles warmly.',
        choices: [
            {
                text: 'Rest — recruit a free pawn',
                effect: 'recruitPawn',
            },
            {
                text: 'Train — give a random piece a modifier',
                effect: 'trainModifier',
            },
        ],
    },
    gamblingDen: {
        id: 'gamblingDen',
        title: 'Gambling Den',
        description: 'Shady figures offer a game of chance. "Double or nothing," they say.',
        choices: [
            {
                text: 'Gamble 10 gold — 50% chance to double it',
                effect: 'gamble',
                requirement: { minGold: 10 },
            },
            {
                text: 'Rob them — free relic but take a battle',
                effect: 'robGamblers',
            },
            {
                text: 'Move along',
                effect: 'none',
            },
        ],
    },
    blessedFountain: {
        id: 'blessedFountain',
        title: 'Blessed Fountain',
        description: 'Crystal-clear water flows from an ancient fountain, shimmering with magical energy.',
        choices: [
            {
                text: 'Drink — promote a random pawn immediately',
                effect: 'promotePawn',
                requirement: { minPawns: 1 },
            },
            {
                text: 'Fill a flask — gain the next battle with a free turn',
                effect: 'grantFreeTurn',
            },
        ],
    },
};

export function getRandomEvent(rng = Math) {
    const all = Object.values(EVENTS);
    return all[Math.floor(rng.random() * all.length)];
}
