import { Piece } from '../pieces/Piece.js';
import { PIECE_TYPES, TEAMS, STARTING_GOLD, TOTAL_FLOORS, ROSTER_LIMIT } from '../data/Constants.js';
import { ARMIES } from '../data/ArmyData.js';
import { SeededRNG } from '../util/SeededRNG.js';
import { FloorGenerator } from './FloorGenerator.js';
import { EncounterGenerator } from './EncounterGenerator.js';
import { RecruitmentSystem } from './RecruitmentSystem.js';
import { RelicSystem } from './RelicSystem.js';
import { RewardTable } from './RewardTable.js';
import { DifficultyScaler } from './DifficultyScaler.js';
import { Shop } from './Shop.js';

export class RunManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.rng = null;
        this.seed = 0;

        this.roster = [];
        this.gold = STARTING_GOLD;
        this.currentFloor = 1;
        this.currentNode = null;
        this.armyId = null;
        this.armyAbility = null;

        this.relicSystem = new RelicSystem(eventBus);
        this.recruitment = new RecruitmentSystem(eventBus);
        this.difficultyScaler = new DifficultyScaler();
        this.floorGenerator = null;
        this.encounterGenerator = null;
        this.rewardTable = null;
        this.shop = null;

        this.map = [];
        this.stats = { battlesWon: 0, piecesLost: 0, piecesRecruited: 0, goldSpent: 0, floorsCleared: 0 };
        this.isActive = false;
    }

    startRun(armyId, seed = null) {
        this.seed = seed || SeededRNG.generateSeed();
        this.rng = new SeededRNG(this.seed);

        this.floorGenerator = new FloorGenerator(this.rng);
        this.encounterGenerator = new EncounterGenerator(this.rng);
        this.rewardTable = new RewardTable(this.rng);
        this.shop = new Shop(this.rng, this.eventBus);

        this.armyId = armyId;
        const army = ARMIES[armyId];
        this.armyAbility = army.ability;

        // Create roster from army
        this.roster = army.pieces.map(p => new Piece(p.type, TEAMS.PLAYER));
        this.gold = STARTING_GOLD;
        this.currentFloor = 1;
        this.currentNode = null;

        this.relicSystem = new RelicSystem(this.eventBus);
        this.stats = { battlesWon: 0, piecesLost: 0, piecesRecruited: 0, goldSpent: 0, floorsCleared: 0 };

        // Apply army-specific starting relics
        this.applyArmyAbility(army);

        // Generate map
        this.map = this.floorGenerator.generateMap(TOTAL_FLOORS);
        this.isActive = true;

        this.eventBus.emit('runStarted', { army, seed: this.seed });
    }

    applyArmyAbility(army) {
        switch (army.ability) {
            case 'earlyPromotion':
                // Handled via armyAbility field in CombatManager
                break;
            case 'knightDoubleCapture':
                for (const p of this.roster) {
                    if (p.type === PIECE_TYPES.KNIGHT) {
                        p.addModifier({ id: 'knightDoubleCapture', type: 'capture', name: 'Double Move on Capture' });
                    }
                }
                break;
            case 'bishopPhase':
                for (const p of this.roster) {
                    if (p.type === PIECE_TYPES.BISHOP) {
                        p.addModifier({ id: 'bishopLeap', type: 'movement', name: 'Phase Through' });
                    }
                }
                break;
            case 'rookShield':
                for (const p of this.roster) {
                    if (p.type === PIECE_TYPES.ROOK) {
                        p.addModifier({ id: 'firstTurnProtection', type: 'protection', name: 'Opening Guard' });
                    }
                }
                break;
            case 'queenSplit':
                for (const p of this.roster) {
                    if (p.type === PIECE_TYPES.QUEEN) {
                        p.addModifier({ id: 'queenSplit', type: 'unique', name: 'Queen Split' });
                    }
                }
                break;
        }
    }

    getCurrentFloorData() {
        return this.map[this.currentFloor - 1] || null;
    }

    getEncounter(nodeType) {
        const difficulty = this.difficultyScaler.getAIDifficulty(this.currentFloor);
        switch (nodeType) {
            case 'battle':
                return this.encounterGenerator.generateBattle(this.currentFloor, difficulty);
            case 'elite':
                return this.encounterGenerator.generateElite(this.currentFloor, difficulty);
            case 'boss':
                return { name: `Boss (Floor ${this.currentFloor})`, isBoss: true, difficulty };
            default:
                return null;
        }
    }

    prepareCombat(encounter) {
        const enemyCount = encounter.enemyPieces ? encounter.enemyPieces.length : Infinity;
        const playerPlacement = this.encounterGenerator.placePlayerPieces(
            this.roster, encounter.cols, encounter.rows, enemyCount
        );

        return {
            cols: encounter.cols,
            rows: encounter.rows,
            playerPieces: playerPlacement,
            enemyPieces: encounter.enemyPieces,
            terrain: encounter.terrain,
            difficulty: encounter.difficulty,
            relics: this.relicSystem.ownedRelics,
            armyAbility: this.armyAbility,
            encounterName: encounter.name,
        };
    }

    onBattleWon(result) {
        this.stats.battlesWon++;
        const mult = this.difficultyScaler.getGoldMultiplier(this.currentFloor, this.relicSystem.ownedRelics);
        const gold = Math.floor((result.goldEarned || 10) * mult);
        this.gold += gold;

        // Remove captured pieces from roster
        if (result.capturedByEnemy) {
            for (const captured of result.capturedByEnemy) {
                const idx = this.roster.findIndex(p => p.id === captured.id);
                if (idx !== -1) {
                    this.roster.splice(idx, 1);
                    this.stats.piecesLost++;
                }
            }
        }

        // Update promoted pieces in roster
        const boardPieces = result.survivingPlayerPieces || [];
        for (const bp of boardPieces) {
            const rosterPiece = this.roster.find(p => p.id === bp.id);
            if (rosterPiece && bp.promotedFrom) {
                rosterPiece.type = bp.type;
                rosterPiece.promotedFrom = bp.promotedFrom;
            }
        }

        return this.rewardTable.getBattleRewards(this.currentFloor, result.isElite);
    }

    onBattleLost() {
        this.isActive = false;
        this.eventBus.emit('runEnded', { victory: false, stats: this.stats });
    }

    advanceFloor() {
        this.currentFloor++;
        this.stats.floorsCleared++;
        if (this.currentFloor > TOTAL_FLOORS) {
            this.isActive = false;
            this.eventBus.emit('runEnded', { victory: true, stats: this.stats });
            return false;
        }
        return true;
    }

    recruitPiece(type) {
        if (this.roster.length >= ROSTER_LIMIT) return null;
        const piece = new Piece(type, TEAMS.PLAYER);

        // Apply army ability modifier to newly recruited pieces
        if (this.armyAbility === 'knightDoubleCapture' && type === PIECE_TYPES.KNIGHT) {
            piece.addModifier({ id: 'knightDoubleCapture', type: 'capture', name: 'Double Move on Capture' });
        }
        if (this.armyAbility === 'rookShield' && type === PIECE_TYPES.ROOK) {
            piece.addModifier({ id: 'firstTurnProtection', type: 'protection', name: 'Opening Guard' });
        }
        if (this.armyAbility === 'bishopPhase' && type === PIECE_TYPES.BISHOP) {
            piece.addModifier({ id: 'bishopLeap', type: 'movement', name: 'Phase Through' });
        }
        if (this.armyAbility === 'queenSplit' && type === PIECE_TYPES.QUEEN) {
            piece.addModifier({ id: 'queenSplit', type: 'unique', name: 'Queen Split' });
        }

        this.roster.push(piece);
        this.stats.piecesRecruited++;
        this.eventBus.emit('pieceRecruited', { piece });
        return piece;
    }

    addRelic(relic) {
        this.relicSystem.addRelic(relic);
    }

    generateShop() {
        const ownedIds = this.relicSystem.ownedRelics.map(r => r.id);
        return this.shop.generate(this.currentFloor, ownedIds);
    }

    purchaseShopItem(item) {
        if (this.gold < item.price) return false;
        this.gold -= item.price;
        this.stats.goldSpent += item.price;

        if (item.category === 'piece') {
            this.recruitPiece(item.type);
        } else if (item.category === 'relic') {
            this.addRelic(item.relic);
        }
        // Modifier purchased — handled in shop state UI

        const idx = this.shop.items.indexOf(item);
        if (idx !== -1) this.shop.items.splice(idx, 1);

        return true;
    }

    serialize() {
        return {
            seed: this.seed,
            armyId: this.armyId,
            roster: this.roster.map(p => p.serialize()),
            gold: this.gold,
            currentFloor: this.currentFloor,
            relics: this.relicSystem.serialize(),
            stats: { ...this.stats },
            isActive: this.isActive,
        };
    }

    deserialize(data) {
        this.seed = data.seed;
        this.rng = new SeededRNG(data.seed);
        // Fast-forward RNG to current state by regenerating the map
        this.floorGenerator = new FloorGenerator(this.rng);
        this.encounterGenerator = new EncounterGenerator(this.rng);
        this.rewardTable = new RewardTable(this.rng);
        this.shop = new Shop(this.rng, this.eventBus);

        this.armyId = data.armyId;
        this.armyAbility = ARMIES[data.armyId]?.ability;
        this.roster = data.roster.map(p => Piece.deserialize(p));
        this.gold = data.gold;
        this.currentFloor = data.currentFloor;
        this.relicSystem.deserialize(data.relics);
        this.stats = data.stats;
        this.isActive = data.isActive;

        this.map = this.floorGenerator.generateMap(TOTAL_FLOORS);
    }
}
