/**
 * Headless Monte Carlo Difficulty Simulation
 *
 * Runs AI-vs-AI combat across full 10-floor runs, modeling 4 player strategies,
 * collecting per-floor statistics on roster size, gold, win rates, and death floor distribution.
 *
 * Build: npx esbuild src/simulation/RunSimulator.js --bundle --platform=node --outfile=dist/simulate.js
 * Run:   node dist/simulate.js [runsPerStrategy] [baseSeed]
 */

import { EventBus } from '../core/EventBus.js';
import { SeededRNG } from '../util/SeededRNG.js';
import { Board } from '../board/Board.js';
import { CombatManager } from '../combat/CombatManager.js';
import { AIController } from '../ai/AIController.js';
import { BossAI } from '../ai/BossAI.js';
import { RunManager } from '../progression/RunManager.js';
import { Piece } from '../pieces/Piece.js';
import { TEAMS, PIECE_TYPES, ROSTER_LIMIT, TOTAL_FLOORS, BOSS_FLOORS, DRAFT_POINTS, DRAFT_COSTS } from '../data/Constants.js';
import { PIECE_VALUES } from '../data/PieceData.js';
import { getBossForFloor } from '../data/BossData.js';
import { getRandomEvent } from '../data/EventData.js';
import { getRandomModifier, getUpgradePackChoices } from '../data/ModifierData.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function meetsRequirement(choice, runManager) {
    if (!choice.requirement) return true;
    if (choice.requirement.minGold && runManager.gold < choice.requirement.minGold) return false;
    if (choice.requirement.minPawns) {
        const pawnCount = runManager.roster.filter(p => p.type === PIECE_TYPES.PAWN).length;
        if (pawnCount < choice.requirement.minPawns) return false;
    }
    return true;
}

function materialScore(board, team) {
    return board.getTeamPieces(team).reduce((sum, p) => sum + (PIECE_VALUES[p.type] || 0), 0);
}

function draftPieces(budget, strategy) {
    const pieces = [];
    const costs = DRAFT_COSTS;
    // Max counts per type to prevent degenerate drafts
    const maxCounts = { queen: 1, rook: 2, bishop: 2, knight: 2, pawn: 8 };

    if (strategy === 'aggressive') {
        // Queen + rook + officers, fill with pawns
        let remaining = budget;
        const order = [['queen', 1], ['rook', 1], ['bishop', 1], ['knight', 1], ['pawn', 8]];
        for (const [type, max] of order) {
            let count = 0;
            while (remaining >= costs[type] && count < max) {
                pieces.push(type);
                remaining -= costs[type];
                count++;
            }
        }
        // Fill remaining with pawns
        while (remaining >= costs.pawn) { pieces.push('pawn'); remaining -= costs.pawn; }
    } else if (strategy === 'cautious') {
        // Many cheap pieces for safety
        let remaining = budget;
        const order = [['pawn', 6], ['knight', 2], ['bishop', 2], ['rook', 1]];
        for (const [type, max] of order) {
            let count = 0;
            while (remaining >= costs[type] && count < max) {
                pieces.push(type);
                remaining -= costs[type];
                count++;
            }
        }
    } else if (strategy === 'pawnFarmer') {
        // Mostly pawns, 1 knight for coverage
        let remaining = budget;
        if (remaining >= costs.knight) { pieces.push('knight'); remaining -= costs.knight; }
        while (remaining >= costs.pawn) { pieces.push('pawn'); remaining -= costs.pawn; }
    } else {
        // Balanced: rook + 2 knights + bishop + fill pawns
        let remaining = budget;
        if (remaining >= costs.rook) { pieces.push('rook'); remaining -= costs.rook; }
        for (let i = 0; i < 2 && remaining >= costs.knight; i++) { pieces.push('knight'); remaining -= costs.knight; }
        if (remaining >= costs.bishop) { pieces.push('bishop'); remaining -= costs.bishop; }
        while (remaining >= costs.pawn) { pieces.push('pawn'); remaining -= costs.pawn; }
    }

    return pieces;
}

function pickUpgrade(choices, roster, strategy) {
    if (choices.length === 0) return null;
    // Strategy-based picking
    const piece = roster.length > 0 ? roster[0] : null;
    if (!piece) return null;

    // Aggressive: prefer capture/risk mods
    if (strategy === 'aggressive') {
        const pref = choices.find(c => c.category === 'capture' || c.category === 'risk');
        return pref || choices[0];
    }
    // Cautious: prefer defense mods
    if (strategy === 'cautious') {
        const pref = choices.find(c => c.category === 'defense');
        return pref || choices[0];
    }
    // Default: highest rarity
    const rarityOrder = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
    const sorted = [...choices].sort((a, b) => (rarityOrder[a.rarity] || 3) - (rarityOrder[b.rarity] || 3));
    return sorted[0];
}

function applyUpgrade(mod, roster, rng) {
    if (!mod || roster.length === 0) return;
    // Apply to piece with fewest modifiers
    const sorted = [...roster].sort((a, b) => a.modifiers.length - b.modifiers.length);
    const target = sorted.find(p => !p.hasModifier(mod.id)) || sorted[0];
    if (target && !target.hasModifier(mod.id)) {
        target.addModifier({ ...mod });
    }
}

// ─── Strategy Definitions ────────────────────────────────────────────────────

const STRATEGIES = {
    aggressive: {
        name: 'Aggressive',
        playerAIDifficulty: 4,
        pathPriority: ['elite', 'battle', 'event', 'shop', 'rest'],
        draftStyle: 'aggressive',
        pickPromotion(roster) { return PIECE_TYPES.QUEEN; },
        pickShopPurchases(items, gold, roster, relics) {
            const purchases = [];
            const sorted = [...items].sort((a, b) => {
                if (a.category === 'relic' && b.category !== 'relic') return -1;
                if (b.category === 'relic' && a.category !== 'relic') return 1;
                const valueA = a.category === 'piece' ? (PIECE_VALUES[a.type] || 1) : 5;
                const valueB = b.category === 'piece' ? (PIECE_VALUES[b.type] || 1) : 5;
                return valueB - valueA;
            });
            let remaining = gold;
            for (const item of sorted) {
                if (item.price <= remaining) {
                    purchases.push(item);
                    remaining -= item.price;
                }
            }
            return purchases;
        },
        pickEventChoice(event, rm) {
            const risky = ['knightChallenge', 'sacrificePawnForRelic', 'gamble', 'mirrorUpgrade', 'robGamblers'];
            for (const choice of event.choices) {
                if (risky.includes(choice.effect) && meetsRequirement(choice, rm)) return choice;
            }
            for (const choice of event.choices) {
                if (choice.effect !== 'none' && meetsRequirement(choice, rm)) return choice;
            }
            return event.choices[event.choices.length - 1];
        },
        handlePrisoners(rm) {
            for (const type of Object.keys(rm.prisoners)) {
                while ((rm.prisoners[type] || 0) >= 3 && rm.roster.length < ROSTER_LIMIT) {
                    rm.convertPrisoners(type);
                }
            }
        },
    },

    cautious: {
        name: 'Cautious',
        playerAIDifficulty: 4,
        pathPriority: ['rest', 'shop', 'event', 'battle'],
        draftStyle: 'cautious',
        pickPromotion(roster) { return PIECE_TYPES.QUEEN; },
        pickShopPurchases(items, gold, roster, relics) {
            const purchases = [];
            const sorted = [...items].sort((a, b) => a.price - b.price);
            let remaining = gold;
            for (const item of sorted) {
                if (item.price <= remaining && item.price <= 15) {
                    purchases.push(item);
                    remaining -= item.price;
                }
            }
            return purchases;
        },
        pickEventChoice(event, rm) {
            const safe = ['findGold', 'recruitPawn', 'smashMirrorGold', 'grantFreeTurn'];
            for (const choice of event.choices) {
                if (safe.includes(choice.effect) && meetsRequirement(choice, rm)) return choice;
            }
            return event.choices[event.choices.length - 1];
        },
        handlePrisoners(rm) {
            for (const type of Object.keys(rm.prisoners)) {
                while ((rm.prisoners[type] || 0) > 0) {
                    rm.releasePrisoner(type);
                }
            }
        },
    },

    pawnFarmer: {
        name: 'Pawn Farmer',
        playerAIDifficulty: 4,
        pathPriority: ['battle', 'event', 'shop', 'rest'],
        draftStyle: 'pawnFarmer',
        pickPromotion(roster) {
            const counts = { knight: 0, bishop: 0, rook: 0 };
            for (const p of roster) {
                if (counts.hasOwnProperty(p.type)) counts[p.type]++;
            }
            let min = Infinity, pick = PIECE_TYPES.KNIGHT;
            for (const [type, count] of Object.entries(counts)) {
                if (count < min) { min = count; pick = type; }
            }
            return pick;
        },
        pickShopPurchases(items, gold, roster, relics) {
            const purchases = [];
            let remaining = gold;
            const sorted = [...items].sort((a, b) => {
                if (a.category === 'relic' && a.id === 'earlyPromotion') return -1;
                if (b.category === 'relic' && b.id === 'earlyPromotion') return 1;
                if (a.category === 'piece' && a.type === PIECE_TYPES.PAWN) return -1;
                if (b.category === 'piece' && b.type === PIECE_TYPES.PAWN) return 1;
                return a.price - b.price;
            });
            for (const item of sorted) {
                if (item.price <= remaining) {
                    purchases.push(item);
                    remaining -= item.price;
                }
            }
            return purchases;
        },
        pickEventChoice(event, rm) {
            const preferred = ['promotePawn', 'recruitPawn', 'trainModifier', 'randomModifier'];
            for (const choice of event.choices) {
                if (preferred.includes(choice.effect) && meetsRequirement(choice, rm)) return choice;
            }
            for (const choice of event.choices) {
                if (choice.effect !== 'none' && meetsRequirement(choice, rm)) return choice;
            }
            return event.choices[event.choices.length - 1];
        },
        handlePrisoners(rm) {
            for (const type of Object.keys(rm.prisoners)) {
                while ((rm.prisoners[type] || 0) >= 3 && rm.roster.length < ROSTER_LIMIT) {
                    rm.convertPrisoners(type);
                }
            }
        },
    },

    balanced: {
        name: 'Balanced',
        playerAIDifficulty: 4,
        pathPriority: ['battle', 'shop', 'event', 'rest'],
        draftStyle: 'balanced',
        pickPromotion(roster) { return PIECE_TYPES.QUEEN; },
        pickShopPurchases(items, gold, roster, relics) {
            const purchases = [];
            let remaining = gold;
            const sorted = [...items].sort((a, b) => {
                if (a.category === 'relic' && b.category !== 'relic') return -1;
                if (b.category === 'relic' && a.category !== 'relic') return 1;
                return a.price - b.price;
            });
            for (const item of sorted) {
                if (item.price <= remaining) {
                    if (item.category === 'piece' && roster.length >= 14) continue;
                    purchases.push(item);
                    remaining -= item.price;
                }
            }
            return purchases;
        },
        pickEventChoice(event, rm) {
            const strong = rm.roster.length >= 12;
            if (strong) {
                const moderate = ['knightChallenge', 'randomModifier', 'trainModifier', 'mirrorUpgrade', 'gamble'];
                for (const choice of event.choices) {
                    if (moderate.includes(choice.effect) && meetsRequirement(choice, rm)) return choice;
                }
            }
            const safe = ['findGold', 'recruitPawn', 'smashMirrorGold', 'grantFreeTurn', 'promotePawn'];
            for (const choice of event.choices) {
                if (safe.includes(choice.effect) && meetsRequirement(choice, rm)) return choice;
            }
            for (const choice of event.choices) {
                if (choice.effect !== 'none' && meetsRequirement(choice, rm)) return choice;
            }
            return event.choices[event.choices.length - 1];
        },
        handlePrisoners(rm) {
            for (const type of Object.keys(rm.prisoners)) {
                if ((rm.prisoners[type] || 0) >= 3 && rm.roster.length < ROSTER_LIMIT) {
                    rm.convertPrisoners(type);
                } else if (rm.gold < 10) {
                    while ((rm.prisoners[type] || 0) > 0) {
                        rm.releasePrisoner(type);
                    }
                }
            }
        },
    },
};

// Balanced adjusts path priority based on roster state
function getPathPriority(strategy, roster) {
    if (strategy === STRATEGIES.balanced) {
        if (roster.length >= 12) return ['battle', 'event', 'shop', 'rest'];
        return ['rest', 'shop', 'battle', 'event'];
    }
    return strategy.pathPriority;
}

// ─── HeadlessCombat ──────────────────────────────────────────────────────────

class HeadlessCombat {
    constructor(eventBus) {
        this.eventBus = eventBus;
    }

    run(boardSetup, options, strategy, bossData = null) {
        const { cols, rows, playerPieces, enemyPieces, terrain } = boardSetup;

        const board = new Board(cols, rows);

        if (terrain) {
            for (const t of terrain) {
                board.setTerrain(t.col, t.row, t.terrain);
            }
        }

        if (bossData && bossData.phases[0].terrain) {
            for (const t of bossData.phases[0].terrain) {
                board.setTerrain(t.col, t.row, t.terrain);
            }
        }

        if (bossData) {
            for (const pd of bossData.phases[0].pieces) {
                const piece = new Piece(pd.type, TEAMS.ENEMY, pd.col, pd.row);
                board.placePiece(piece, pd.col, pd.row);
            }
        } else {
            for (const pd of enemyPieces) {
                const piece = new Piece(pd.type, TEAMS.ENEMY, pd.col, pd.row);
                board.placePiece(piece, pd.col, pd.row);
            }
        }

        for (const pp of playerPieces) {
            board.placePiece(pp.piece, pp.col, pp.row);
        }

        const combat = new CombatManager(this.eventBus);
        combat.initBattle(board, {
            difficulty: options.difficulty || 2,
            relics: options.relics || [],
            armyAbility: options.armyAbility || null,
        });

        const playerAI = new AIController(board, this.eventBus);
        playerAI.setDifficulty(strategy.playerAIDifficulty);
        playerAI.modifierSystem = combat.modifierSystem;
        playerAI.relics = options.relics || [];
        playerAI.turnManager = combat.turnManager;

        let bossAI = null;
        if (bossData) {
            bossAI = new BossAI(board, this.eventBus, bossData);
        }

        const MAX_TURNS = 200;
        let maxTurnsReached = false;

        while (!combat.gameOver) {
            if (combat.turnManager.turnNumber >= MAX_TURNS) {
                const playerMat = materialScore(board, TEAMS.PLAYER);
                const enemyMat = materialScore(board, TEAMS.ENEMY);
                combat.endBattle(playerMat > enemyMat ? TEAMS.PLAYER : TEAMS.ENEMY);
                maxTurnsReached = true;
                break;
            }

            if (bossAI && !combat.turnManager.isPlayerTurn) {
                bossAI.checkPhaseTransition();
            }

            let moveResult;
            if (combat.turnManager.isPlayerTurn) {
                const move = playerAI.getBestMove(TEAMS.PLAYER);
                if (!move) {
                    combat.endTurn();
                    continue;
                }
                moveResult = combat.executeMove(move.piece, move.move.col, move.move.row, move.move);
            } else {
                let move;
                if (bossAI) {
                    move = bossAI.getBestMove();
                } else {
                    move = combat.getAIMove();
                }
                if (!move) {
                    combat.endTurn();
                    continue;
                }
                moveResult = combat.executeMove(move.piece, move.move.col, move.move.row, move.move);
            }

            if (!moveResult || !moveResult.success) {
                combat.endTurn();
                continue;
            }

            if (combat.gameOver) break;

            if (moveResult.needsPromotion) {
                if (moveResult.piece.team === TEAMS.PLAYER) {
                    combat.promotePiece(moveResult.piece, strategy.pickPromotion([]));
                } else {
                    combat.promotePiece(moveResult.piece, PIECE_TYPES.QUEEN);
                }
            }

            if (combat.gameOver) break;

            combat.endTurn();
        }

        return {
            outcome: combat.winner === TEAMS.PLAYER ? 'win' : 'loss',
            turns: combat.turnManager.turnNumber,
            capturedByPlayer: combat.capturedByPlayer,
            capturedByEnemy: combat.capturedByEnemy,
            survivingPlayerPieces: board.getTeamPieces(TEAMS.PLAYER),
            goldEarned: combat.goldEarned,
            maxTurnsReached,
        };
    }
}

// ─── Event Resolution (headless) ─────────────────────────────────────────────

function resolveEventChoice(choice, rm) {
    if (!meetsRequirement(choice, rm)) return;
    const rng = rm.rng;

    switch (choice.effect) {
        case 'none': break;
        case 'sacrificePawnForRelic': {
            const pawns = rm.roster.filter(p => p.type === PIECE_TYPES.PAWN);
            if (pawns.length > 0) {
                rm.roster.splice(rm.roster.indexOf(pawns[0]), 1);
                const relic = rm.relicSystem.getRandomReward(rng);
                if (relic) rm.addRelic(relic);
            }
            break;
        }
        case 'buyKnight':
            rm.gold -= 15;
            rm.recruitPiece(PIECE_TYPES.KNIGHT);
            break;
        case 'knightChallenge':
            if (rng.random() < 0.6) {
                rm.recruitPiece(PIECE_TYPES.KNIGHT);
            } else {
                const pawns = rm.roster.filter(p => p.type === PIECE_TYPES.PAWN);
                if (pawns.length > 0) {
                    rm.roster.splice(rm.roster.indexOf(pawns[0]), 1);
                }
            }
            break;
        case 'randomModifier':
        case 'trainModifier': {
            const mod = getRandomModifier(rng);
            if (mod && rm.roster.length > 0) {
                // Universal modifiers: apply to random piece that doesn't have it
                const valid = rm.roster.filter(p => !p.hasModifier(mod.id));
                if (valid.length > 0) {
                    rng.randomChoice(valid).addModifier({ ...mod });
                }
            }
            break;
        }
        case 'findGold':
            rm.gold += rng.randomInt(10, 20);
            break;
        case 'mirrorUpgrade': {
            const pawns = rm.roster.filter(p => p.type === PIECE_TYPES.PAWN);
            if (pawns.length > 0) {
                rm.roster.splice(rm.roster.indexOf(pawns[0]), 1);
                const types = [PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK];
                const upgradeType = rng.randomChoice(types);
                const mod = getRandomModifier(rng);
                const upgradePiece = rm.recruitPiece(upgradeType);
                if (upgradePiece && mod) upgradePiece.addModifier({ ...mod });
            }
            break;
        }
        case 'smashMirrorGold':
            rm.gold += 12;
            break;
        case 'recruitPawn':
            rm.recruitPiece(PIECE_TYPES.PAWN);
            break;
        case 'gamble':
            rm.gold -= 10;
            if (rng.random() < 0.5) rm.gold += 20;
            break;
        case 'robGamblers': {
            const relic = rm.relicSystem.getRandomReward(rng);
            if (relic) rm.addRelic(relic);
            break;
        }
        case 'promotePawn': {
            const pawns = rm.roster.filter(p => p.type === PIECE_TYPES.PAWN);
            if (pawns.length > 0) {
                const types = [PIECE_TYPES.KNIGHT, PIECE_TYPES.BISHOP, PIECE_TYPES.ROOK];
                pawns[0].promote(rng.randomChoice(types));
            }
            break;
        }
        case 'grantFreeTurn':
            rm.addRelic({ id: 'freeMove', name: 'Initiative Crown', description: 'Start each battle with a free move' });
            break;
    }
}

// ─── HeadlessRun ─────────────────────────────────────────────────────────────

class HeadlessRun {
    constructor(strategy, seed) {
        this.strategy = strategy;
        this.seed = seed;
        this.eventBus = new EventBus();
        this.rm = new RunManager(this.eventBus);
        this.combat = new HeadlessCombat(this.eventBus);
        this.floorStats = [];
        this.battleResults = [];
        this.deathFloor = null;
        this.victory = false;
    }

    run() {
        // Draft pieces based on strategy
        const budget = DRAFT_POINTS.normal;
        const pieces = draftPieces(budget, this.strategy.draftStyle);
        this.rm.startRunFromDraft('normal', pieces, this.seed);

        // Post-draft upgrade
        this.simulateUpgrade();

        for (let floor = 1; floor <= TOTAL_FLOORS; floor++) {
            const floorStart = {
                floor,
                rosterStart: this.rm.roster.length,
                goldStart: this.rm.gold,
                rosterEnd: 0,
                goldEnd: 0,
                combatResults: [],
                survived: false,
            };

            this.strategy.handlePrisoners(this.rm);

            const floorData = this.rm.getCurrentFloorData();
            if (!floorData) break;

            const visited = new Set();
            this.navigateFloor(floorData, visited);

            if (!this.rm.isActive) {
                floorStart.rosterEnd = this.rm.roster.length;
                floorStart.goldEnd = this.rm.gold;
                floorStart.survived = false;
                this.floorStats.push(floorStart);
                this.deathFloor = floor;
                return;
            }

            floorStart.rosterEnd = this.rm.roster.length;
            floorStart.goldEnd = this.rm.gold;
            floorStart.survived = true;
            this.floorStats.push(floorStart);

            if (!this.rm.advanceFloor()) {
                this.victory = true;
                return;
            }
        }
    }

    simulateUpgrade() {
        const rosterTypes = this.rm.roster.map(p => p.type);
        const choices = getUpgradePackChoices(this.rm.rng, [], 3, rosterTypes);
        const mod = pickUpgrade(choices, this.rm.roster, this.strategy.draftStyle);
        applyUpgrade(mod, this.rm.roster, this.rm.rng);
    }

    navigateFloor(floorData, visited) {
        const nodes = floorData.nodes;
        if (nodes.length === 0) return;

        const layers = {};
        for (const node of nodes) {
            if (!layers[node.layer]) layers[node.layer] = [];
            layers[node.layer].push(node);
        }

        const layerKeys = Object.keys(layers).sort((a, b) => a - b);

        let currentNodeId = null;
        for (const layerKey of layerKeys) {
            const layerNodes = layers[layerKey];

            let reachable;
            if (currentNodeId === null) {
                reachable = layerNodes;
            } else {
                const currentNode = nodes.find(n => n.id === currentNodeId);
                reachable = layerNodes.filter(n => currentNode.connections.includes(n.id));
                if (reachable.length === 0) reachable = layerNodes;
            }

            const priority = getPathPriority(this.strategy, this.rm.roster);
            reachable.sort((a, b) => {
                const aIdx = priority.indexOf(a.type);
                const bIdx = priority.indexOf(b.type);
                return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
            });

            let chosen = reachable[0];
            if ((this.strategy === STRATEGIES.cautious || this.strategy === STRATEGIES.pawnFarmer) && chosen.type === 'elite') {
                const nonElite = reachable.find(n => n.type !== 'elite');
                if (nonElite) chosen = nonElite;
            }

            currentNodeId = chosen.id;
            this.processNode(chosen);

            if (!this.rm.isActive) return;
        }
    }

    processNode(node) {
        switch (node.type) {
            case 'battle':
            case 'elite':
                this.processBattle(node.type);
                break;
            case 'boss':
                this.processBoss();
                break;
            case 'shop':
                this.processShop();
                break;
            case 'event':
                this.processEvent();
                break;
            case 'rest':
                this.processRest();
                break;
        }
    }

    processBattle(nodeType) {
        const encounter = this.rm.getEncounter(nodeType);
        if (!encounter) return;

        const setup = this.rm.prepareCombat(encounter);
        const result = this.combat.run(setup, {
            difficulty: setup.difficulty,
            relics: setup.relics,
            armyAbility: setup.armyAbility,
        }, this.strategy);

        if (result.outcome === 'win') {
            const rewards = this.rm.onBattleWon({
                goldEarned: result.goldEarned,
                capturedByEnemy: result.capturedByEnemy,
                capturedByPlayer: result.capturedByPlayer,
                survivingPlayerPieces: result.survivingPlayerPieces,
                isElite: encounter.isElite,
            });
            this.applyRewards(rewards);
            // Post-battle upgrade
            this.simulateUpgrade();
        } else {
            this.rm.onBattleLost();
        }

        this.battleResults.push({
            floor: this.rm.currentFloor,
            type: nodeType,
            outcome: result.outcome,
            turns: result.turns,
            piecesLost: result.capturedByEnemy.length,
            maxTurnsReached: result.maxTurnsReached,
        });
    }

    processBoss() {
        const bossData = getBossForFloor(this.rm.currentFloor);
        if (!bossData) return;

        const { cols, rows } = bossData.boardSize;

        const playerPlacement = this.rm.encounterGenerator.placePlayerPieces(
            this.rm.roster, cols, rows, bossData.phases[0].pieces.length
        );

        const result = this.combat.run({
            cols, rows,
            playerPieces: playerPlacement,
            enemyPieces: [],
            terrain: [],
        }, {
            difficulty: bossData.difficulty,
            relics: this.rm.relicSystem.ownedRelics,
            armyAbility: this.rm.armyAbility,
        }, this.strategy, bossData);

        if (result.outcome === 'win') {
            const rewards = this.rm.onBattleWon({
                goldEarned: result.goldEarned,
                capturedByEnemy: result.capturedByEnemy,
                capturedByPlayer: result.capturedByPlayer,
                survivingPlayerPieces: result.survivingPlayerPieces,
                isElite: false,
            });
            this.applyRewards(rewards);
            // Post-boss upgrade
            this.simulateUpgrade();
        } else {
            this.rm.onBattleLost();
        }

        this.battleResults.push({
            floor: this.rm.currentFloor,
            type: 'boss',
            outcome: result.outcome,
            turns: result.turns,
            piecesLost: result.capturedByEnemy.length,
            maxTurnsReached: result.maxTurnsReached,
        });
    }

    applyRewards(rewards) {
        if (!rewards) return;

        if (rewards.gold) {
            this.rm.gold += rewards.gold;
        }

        // Recruit ALL free options (pawn + optional officer)
        if (rewards.recruitOptions) {
            for (const opt of rewards.recruitOptions) {
                if (opt.cost === 0) {
                    this.rm.recruitPiece(opt.type);
                }
            }
        }

        if (rewards.relic) {
            this.rm.addRelic(rewards.relic);
        }
    }

    processShop() {
        const items = this.rm.generateShop();
        const purchases = this.strategy.pickShopPurchases(
            items, this.rm.gold, this.rm.roster, this.rm.relicSystem.ownedRelics
        );
        for (const item of purchases) {
            this.rm.purchaseShopItem(item);
        }
    }

    processEvent() {
        const event = getRandomEvent(this.rm.rng);
        const choice = this.strategy.pickEventChoice(event, this.rm);
        resolveEventChoice(choice, this.rm);
    }

    processRest() {
        // Rest stops recruit a pawn + chance for a knight
        this.rm.recruitPiece(PIECE_TYPES.PAWN);
        if (this.rm.relicSystem.hasRelic('healingRest') || this.rm.rng.random() < 0.3) {
            this.rm.recruitPiece(PIECE_TYPES.KNIGHT);
        }
    }
}

// ─── SimulationRunner ────────────────────────────────────────────────────────

class SimulationRunner {
    constructor(runsPerStrategy, baseSeed) {
        this.runsPerStrategy = runsPerStrategy;
        this.baseSeed = baseSeed;
        this.results = {};
    }

    run() {
        const strategyNames = Object.keys(STRATEGIES);
        const total = strategyNames.length * this.runsPerStrategy;
        let completed = 0;

        for (const key of strategyNames) {
            const strategy = STRATEGIES[key];
            const stratResults = {
                wins: 0,
                losses: 0,
                deathFloors: new Array(TOTAL_FLOORS + 1).fill(0),
                totalBattles: 0,
                totalPiecesLost: 0,
                totalMaxTurns: 0,
                avgDeathFloor: 0,
                floorData: [],
                runs: [],
            };

            for (let f = 1; f <= TOTAL_FLOORS; f++) {
                stratResults.floorData.push({
                    floor: f,
                    rosterSum: 0,
                    goldSum: 0,
                    count: 0,
                });
            }

            for (let i = 0; i < this.runsPerStrategy; i++) {
                const seed = this.baseSeed + i * 1000 + Object.keys(STRATEGIES).indexOf(key) * 100000;
                const run = new HeadlessRun(strategy, seed);

                try {
                    run.run();
                } catch (e) {
                    completed++;
                    continue;
                }

                if (run.victory) {
                    stratResults.wins++;
                } else {
                    stratResults.losses++;
                    if (run.deathFloor) stratResults.deathFloors[run.deathFloor]++;
                }

                for (const fs of run.floorStats) {
                    const fd = stratResults.floorData[fs.floor - 1];
                    fd.rosterSum += fs.rosterStart;
                    fd.goldSum += fs.goldStart;
                    fd.count++;
                }

                for (const br of run.battleResults) {
                    stratResults.totalBattles++;
                    stratResults.totalPiecesLost += br.piecesLost;
                    if (br.maxTurnsReached) stratResults.totalMaxTurns++;
                }

                stratResults.runs.push({
                    victory: run.victory,
                    deathFloor: run.deathFloor,
                    battlesWon: run.battleResults.filter(b => b.outcome === 'win').length,
                });

                completed++;
                if (completed % 50 === 0 || completed === total) {
                    process.stderr.write(`\r  Progress: ${completed}/${total} runs (${Math.round(completed / total * 100)}%)`);
                }
            }

            const lostRuns = stratResults.runs.filter(r => !r.victory);
            stratResults.avgDeathFloor = lostRuns.length > 0
                ? lostRuns.reduce((s, r) => s + (r.deathFloor || 0), 0) / lostRuns.length
                : 0;

            this.results[key] = stratResults;
        }

        process.stderr.write('\n');
    }

    printResults() {
        const N = this.runsPerStrategy;
        const keys = Object.keys(STRATEGIES);

        console.log('\n' + '='.repeat(95));
        console.log('  OVERALL WIN RATES');
        console.log('='.repeat(95));
        console.log(
            pad('Strategy', 16) +
            pad('Wins', 8) +
            pad('Losses', 8) +
            pad('Win%', 8) +
            pad('AvgFloor', 10) +
            pad('AvgBattles', 12) +
            pad('AvgLost', 10) +
            pad('MaxTurns', 10)
        );
        console.log('-'.repeat(95));

        for (const key of keys) {
            const r = this.results[key];
            const totalRuns = r.wins + r.losses;
            const winPct = totalRuns > 0 ? (r.wins / totalRuns * 100).toFixed(1) : '0.0';
            const avgBattles = totalRuns > 0 ? (r.totalBattles / totalRuns).toFixed(1) : '0';
            const avgLost = totalRuns > 0 ? (r.totalPiecesLost / totalRuns).toFixed(1) : '0';
            const avgFloor = r.avgDeathFloor > 0 ? r.avgDeathFloor.toFixed(1) : (r.wins > 0 ? '10+' : 'N/A');

            console.log(
                pad(STRATEGIES[key].name, 16) +
                pad(String(r.wins), 8) +
                pad(String(r.losses), 8) +
                pad(winPct + '%', 8) +
                pad(String(avgFloor), 10) +
                pad(avgBattles, 12) +
                pad(avgLost, 10) +
                pad(String(r.totalMaxTurns), 10)
            );
        }

        console.log('\n' + '='.repeat(75));
        console.log('  DEATH FLOOR DISTRIBUTION');
        console.log('='.repeat(75));

        let header = pad('Floor', 8);
        for (const key of keys) {
            header += pad(STRATEGIES[key].name, 17);
        }
        console.log(header);
        console.log('-'.repeat(75));

        for (let f = 1; f <= TOTAL_FLOORS; f++) {
            const isBoss = BOSS_FLOORS.includes(f);
            let row = pad(`F${f}${isBoss ? '*' : ' '}`, 8);
            for (const key of keys) {
                const r = this.results[key];
                const deaths = r.deathFloors[f];
                const totalRuns = r.wins + r.losses;
                const pct = totalRuns > 0 ? (deaths / totalRuns * 100).toFixed(1) : '0.0';
                row += pad(`${deaths} (${pct}%)`, 17);
            }
            console.log(row);
        }
        console.log('  (* = boss floor)');

        console.log('\n' + '='.repeat(85));
        console.log('  PER-FLOOR AVERAGES (Roster / Gold)');
        console.log('='.repeat(85));

        header = pad('Floor', 8);
        for (const key of keys) {
            header += pad(STRATEGIES[key].name, 20);
        }
        console.log(header);
        console.log('-'.repeat(85));

        for (let f = 1; f <= TOTAL_FLOORS; f++) {
            const isBoss = BOSS_FLOORS.includes(f);
            let row = pad(`F${f}${isBoss ? '*' : ' '}`, 8);
            for (const key of keys) {
                const fd = this.results[key].floorData[f - 1];
                if (fd.count > 0) {
                    const avgRoster = (fd.rosterSum / fd.count).toFixed(1);
                    const avgGold = (fd.goldSum / fd.count).toFixed(0);
                    const totalRuns = this.results[key].wins + this.results[key].losses;
                    row += pad(`${avgRoster}p / ${avgGold}g (${fd.count}/${totalRuns})`, 20);
                } else {
                    row += pad('—', 20);
                }
            }
            console.log(row);
        }

        console.log('\n' + '='.repeat(85));
    }
}

function pad(str, width) {
    str = String(str);
    return str + ' '.repeat(Math.max(0, width - str.length));
}

// ─── Main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const runsPerStrategy = parseInt(args[0], 10) || 50;
const baseSeed = parseInt(args[1], 10) || 42;

console.log(`\nBlanca Monte Carlo Difficulty Simulation`);
console.log(`  Runs per strategy: ${runsPerStrategy}`);
console.log(`  Base seed: ${baseSeed}`);
console.log(`  Strategies: ${Object.values(STRATEGIES).map(s => s.name).join(', ')}`);
console.log(`  Draft: Normal difficulty (${DRAFT_POINTS.normal} pts)`);
console.log('');

const sim = new SimulationRunner(runsPerStrategy, baseSeed);
sim.run();
sim.printResults();
